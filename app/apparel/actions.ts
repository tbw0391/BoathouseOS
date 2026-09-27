"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, siteOrigin } from "@/lib/stripe";
import { getPaymentSettings, markOrderPaid, startOrderCheckout } from "@/lib/billing";
import { parseMoney } from "@/lib/payments";
import type { Order, OrderItem, OrderWindow, Product, ProductStock, Profile } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

async function requireTreasurer() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("role, is_treasurer").eq("id", user.id).single();
  const me = data as Pick<Profile, "role" | "is_treasurer"> | null;
  if (me?.role !== "admin" && !me?.is_treasurer) throw new Error("Only the treasurer or an admin can do that.");
  return { supabase, user };
}

function revalidateApparel() {
  revalidatePath("/apparel", "layout");
}

// --- Treasurer: products, stock, order windows, orders ---

export async function createProduct(formData: FormData) {
  const { supabase } = await requireTreasurer();
  const name = String(formData.get("name") ?? "").trim();
  const price = parseMoney(String(formData.get("price") ?? ""));
  const sizes = String(formData.get("sizes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!name) throw new Error("Name the item.");
  if (!price) throw new Error("Enter a price, like 25.");

  const inStock = formData.get("in_stock_item") === "on";
  const { data, error } = await supabase
    .from("products")
    .insert({
      name,
      price_cents: price,
      sizes,
      description: String(formData.get("description") ?? "").trim() || null,
      image_url: String(formData.get("image_url") ?? "").trim() || null,
      in_stock_item: inStock,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (inStock) {
    const { error: stockError } = await supabase
      .from("product_stock")
      .insert((sizes.length ? sizes : [""]).map((size) => ({ product_id: (data as { id: string }).id, size, quantity: 0 })));
    if (stockError) throw new Error(stockError.message);
  }
  revalidateApparel();
}

export async function setProductActive(productId: string, active: boolean) {
  const { supabase } = await requireTreasurer();
  const { error } = await supabase.from("products").update({ active }).eq("id", productId);
  if (error) throw new Error(error.message);
  revalidateApparel();
}

export async function setStock(productId: string, size: string, quantity: number) {
  const { supabase } = await requireTreasurer();
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Stock must be 0 or more.");
  const { error } = await supabase
    .from("product_stock")
    .upsert({ product_id: productId, size, quantity }, { onConflict: "product_id,size" });
  if (error) throw new Error(error.message);
  revalidateApparel();
}

export async function createOrderWindow(formData: FormData) {
  const { supabase } = await requireTreasurer();
  const title = String(formData.get("title") ?? "").trim();
  const closes = String(formData.get("closes_on") ?? "");
  const productIds = formData.getAll("product_ids").map(String).filter(Boolean);
  if (!title) throw new Error("Name the order, like Fall team gear.");
  if (!closes) throw new Error("Pick the last day to order.");
  if (productIds.length === 0) throw new Error("Pick at least one item.");

  // Open through the end of the chosen day, Eastern.
  const closesAt = new Date(`${closes}T23:59:59-04:00`).toISOString();
  const { data, error } = await supabase
    .from("order_windows")
    .insert({ title, description: String(formData.get("description") ?? "").trim() || null, closes_at: closesAt })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: linkError } = await supabase
    .from("order_window_products")
    .insert(productIds.map((product_id) => ({ window_id: (data as { id: string }).id, product_id })));
  if (linkError) throw new Error(linkError.message);
  revalidateApparel();
}

export async function closeOrderWindow(windowId: string) {
  const { supabase } = await requireTreasurer();
  const { error } = await supabase
    .from("order_windows")
    .update({ closes_at: new Date().toISOString() })
    .eq("id", windowId);
  if (error) throw new Error(error.message);
  revalidateApparel();
}

export async function setOrderStatus(orderId: string, status: "picked_up" | "cancelled" | "paid") {
  const { supabase } = await requireTreasurer();
  if (status === "paid") {
    await markOrderPaid(createAdminClient(), orderId);
    revalidateApparel();
    return;
  }
  const { error } = await supabase
    .from("orders")
    .update({ status, picked_up_at: status === "picked_up" ? new Date().toISOString() : null })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidateApparel();
}

// --- Members: place an order ---

export interface CartLine {
  productId: string;
  size: string;
  quantity: number;
}

// Places an order (from an open order window, or in-stock items when
// windowId is null) at today's prices, then sends the buyer to Stripe.
// Returns the Stripe URL, or null when online payments aren't on yet and
// the treasurer will collect.
export async function placeOrder({
  windowId,
  forRowerId,
  lines,
}: {
  windowId: string | null;
  forRowerId: string | null;
  lines: CartLine[];
}): Promise<string | null> {
  const { supabase, user } = await requireUser();
  const cart = lines.filter((l) => l.quantity > 0);
  if (cart.length === 0) throw new Error("Your cart is empty.");
  if (cart.some((l) => !Number.isInteger(l.quantity) || l.quantity > 50)) throw new Error("Check the quantities.");
  if (forRowerId) {
    const { data: ok } = await supabase.rpc("can_see_rower", { rower: forRowerId });
    if (ok !== true) throw new Error("You can only order for yourself or your own rowers.");
  }

  const admin = createAdminClient();
  const { data: productRows } = await admin
    .from("products")
    .select("*")
    .in("id", [...new Set(cart.map((l) => l.productId))]);
  const products = new Map(((productRows as Product[] | null) ?? []).map((p) => [p.id, p]));

  if (windowId) {
    const { data: windowRow } = await admin.from("order_windows").select("*").eq("id", windowId).single();
    const window = windowRow as OrderWindow | null;
    const now = Date.now();
    if (!window || Date.parse(window.opens_at) > now || Date.parse(window.closes_at) < now) {
      throw new Error("This order window is closed.");
    }
    const { data: inWindow } = await admin.from("order_window_products").select("product_id").eq("window_id", windowId);
    const allowed = new Set(((inWindow as { product_id: string }[] | null) ?? []).map((r) => r.product_id));
    if (cart.some((l) => !allowed.has(l.productId))) throw new Error("Something in your cart isn't in this order.");
  } else {
    const { data: stockRows } = await admin
      .from("product_stock")
      .select("*")
      .in("product_id", [...products.keys()]);
    const stock = new Map(((stockRows as ProductStock[] | null) ?? []).map((s) => [`${s.product_id}:${s.size}`, s.quantity]));
    for (const l of cart) {
      const p = products.get(l.productId);
      if (!p?.in_stock_item) throw new Error("That item isn't sold from stock.");
      if ((stock.get(`${l.productId}:${l.size}`) ?? 0) < l.quantity) {
        throw new Error(`Only ${stock.get(`${l.productId}:${l.size}`) ?? 0} of ${p.name}${l.size ? ` (${l.size})` : ""} left.`);
      }
    }
  }

  for (const l of cart) {
    const p = products.get(l.productId);
    if (!p || !p.active) throw new Error("An item in your cart isn't available anymore.");
    if (p.sizes.length ? !p.sizes.includes(l.size) : l.size !== "") throw new Error(`Pick a size for ${p.name}.`);
  }

  const total = cart.reduce((sum, l) => sum + (products.get(l.productId) as Product).price_cents * l.quantity, 0);
  const { data: orderRow, error } = await admin
    .from("orders")
    .insert({ buyer_id: user.id, for_rower_id: forRowerId, window_id: windowId, total_cents: total })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const order = orderRow as Order;
  const { data: itemRows, error: itemsError } = await admin
    .from("order_items")
    .insert(
      cart.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        size: l.size,
        quantity: l.quantity,
        price_cents: (products.get(l.productId) as Product).price_cents,
      }))
    )
    .select("*");
  if (itemsError) throw new Error(itemsError.message);
  revalidateApparel();

  const stripe = getStripe();
  const settings = await getPaymentSettings(admin);
  if (!stripe || !settings.stripe_account_id || !settings.stripe_charges_enabled) return null;
  return startOrderCheckout(admin, stripe, {
    order,
    items: (itemRows as OrderItem[] | null) ?? [],
    productNames: new Map([...products.values()].map((p) => [p.id, p.name])),
    settings,
    userId: user.id,
    origin: await siteOrigin(),
  });
}
