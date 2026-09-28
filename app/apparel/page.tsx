import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderItem,
  OrderWindow,
  PaymentSettings,
  Product,
  ProductStock,
  Profile,
} from "@/lib/database.types";
import { formatMoney } from "@/lib/payments";
import { Shop } from "./Shop";

// Club apparel: open order windows for custom gear, and items kept in stock
// at the boathouse. (The external team store link stays on /store.)
export default async function ApparelPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const { paid } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: meData } = await supabase
    .from("profiles")
    .select("id, role, is_treasurer, is_apparel_chair, spouse_id, display_name")
    .eq("id", user.id)
    .single();
  const me = meData as Pick<Profile, "id" | "role" | "is_treasurer" | "is_apparel_chair" | "spouse_id" | "display_name">;
  const isTreasurer = me.role === "admin" || me.is_treasurer;
  const canManage = isTreasurer || me.is_apparel_chair;

  const nowIso = new Date().toISOString();
  const [
    { data: productRows },
    { data: stockRows },
    { data: windowRows },
    { data: windowProductRows },
    { data: settingsRow },
    { data: linkRows },
    { data: orderRows },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("name"),
    supabase.from("product_stock").select("*"),
    supabase.from("order_windows").select("*").lte("opens_at", nowIso).gte("closes_at", nowIso).order("closes_at"),
    supabase.from("order_window_products").select("*"),
    supabase.from("payment_settings").select("*").single(),
    supabase.from("family_links").select("rower_id").in("guardian_id", [user.id, ...(me.spouse_id ? [me.spouse_id] : [])]),
    supabase.from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const products = (productRows as Product[] | null) ?? [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const stock = Object.fromEntries(
    ((stockRows as ProductStock[] | null) ?? []).map((s) => [`${s.product_id}:${s.size}`, s.quantity])
  );
  const windows = (windowRows as OrderWindow[] | null) ?? [];
  const windowProducts = (windowProductRows as { window_id: string; product_id: string }[] | null) ?? [];
  const settings = settingsRow as PaymentSettings;
  const online = !!process.env.STRIPE_SECRET_KEY && settings.stripe_charges_enabled;
  const orders = (orderRows as Order[] | null) ?? [];

  const rowerIds = [
    ...(me.role === "rower" || me.role === "coxswain" ? [user.id] : []),
    ...((linkRows as { rower_id: string }[] | null) ?? []).map((l) => l.rower_id),
  ];
  const { data: rowerRows } = rowerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", rowerIds)
    : { data: [] };
  const rowers = (rowerRows as Pick<Profile, "id" | "display_name">[] | null) ?? [];

  const { data: itemRows } = orders.length
    ? await supabase
        .from("order_items")
        .select("*")
        .in(
          "order_id",
          orders.map((o) => o.id)
        )
    : { data: [] };
  const items = (itemRows as OrderItem[] | null) ?? [];

  const inStock = products.filter((p) => p.in_stock_item);
  const STATUS: Record<Order["status"], string> = {
    pending: "Not paid yet",
    paid: "Paid",
    picked_up: "Picked up",
    cancelled: "Cancelled",
  };

  return (
    <div className="min-h-screen p-8 max-w-2xl flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Apparel</h1>
        {canManage && (
          <Link href="/apparel/manage" className="text-sm font-medium text-[var(--color-primary)] underline">
            Manage apparel →
          </Link>
        )}
      </div>

      {paid && (
        <p className="rounded-lg border-2 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-800">
          Thank you! Your order is paid. The treasurer will let you know when it&apos;s ready.
        </p>
      )}

      {windows.map((w) => (
        <section key={w.id} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">{w.title}</h2>
            <p className="text-sm text-gray-600">
              Order by {new Date(w.closes_at).toLocaleDateString()}. Gear is ordered for everyone together after that.
            </p>
            {w.description && <p className="text-sm text-gray-600">{w.description}</p>}
          </div>
          <Shop
            windowId={w.id}
            products={windowProducts
              .filter((wp) => wp.window_id === w.id)
              .map((wp) => productById.get(wp.product_id))
              .filter((p): p is Product => !!p)}
            stock={null}
            rowers={rowers}
            online={online}
          />
        </section>
      ))}

      {inStock.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">In stock at the boathouse</h2>
            <p className="text-sm text-gray-600">Buy now and pick up at the boathouse.</p>
          </div>
          <Shop windowId={null} products={inStock} stock={stock} rowers={rowers} online={online} />
        </section>
      )}

      {windows.length === 0 && inStock.length === 0 && (
        <p className="text-sm text-gray-500">Nothing for sale right now.</p>
      )}

      {orders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Your orders</h2>
          {orders.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-2 border-b py-2 text-sm">
              <span>
                {new Date(o.created_at).toLocaleDateString()} ·{" "}
                {items
                  .filter((i) => i.order_id === o.id)
                  .map((i) => `${i.quantity} × ${productById.get(i.product_id)?.name ?? "Item"}${i.size ? ` (${i.size})` : ""}`)
                  .join(", ")}
              </span>
              <span className="shrink-0 text-right">
                {formatMoney(o.total_cents)}
                <br />
                <span className="text-xs text-gray-500">{STATUS[o.status]}</span>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
