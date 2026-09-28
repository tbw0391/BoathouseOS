import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderWindow, Product, ProductStock, Profile } from "@/lib/database.types";
import { formatMoney } from "@/lib/payments";
import {
  CloseWindowButton,
  NewOrderWindowForm,
  NewProductForm,
  OrderActions,
  ProductActions,
  StockEditor,
} from "./ApparelControls";

// Treasurer: items and stock, order windows (with the size-by-size list to
// send the vendor), and orders to hand out.
export default async function ManageApparelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: meData } = await supabase
    .from("profiles")
    .select("role, is_treasurer, is_apparel_chair")
    .eq("id", user?.id ?? "")
    .single();
  const me = meData as Pick<Profile, "role" | "is_treasurer" | "is_apparel_chair"> | null;
  const canTakePayment = me?.role === "admin" || !!me?.is_treasurer;
  if (!canTakePayment && !me?.is_apparel_chair) notFound();

  const [
    { data: productRows },
    { data: stockRows },
    { data: windowRows },
    { data: windowProductRows },
    { data: orderRows },
    { data: itemRows },
  ] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("product_stock").select("*"),
    supabase.from("order_windows").select("*").order("closes_at", { ascending: false }),
    supabase.from("order_window_products").select("*"),
    supabase.from("orders").select("*").neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("order_items").select("*"),
  ]);
  const products = (productRows as Product[] | null) ?? [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const stock = (stockRows as ProductStock[] | null) ?? [];
  const windows = (windowRows as OrderWindow[] | null) ?? [];
  const windowProducts = (windowProductRows as { window_id: string; product_id: string }[] | null) ?? [];
  const orders = (orderRows as Order[] | null) ?? [];
  const items = (itemRows as OrderItem[] | null) ?? [];

  const personIds = [...new Set(orders.flatMap((o) => [o.buyer_id, ...(o.for_rower_id ? [o.for_rower_id] : [])]))];
  const { data: nameRows } = personIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", personIds)
    : { data: [] };
  const nameById = new Map(
    ((nameRows as Pick<Profile, "id" | "display_name">[] | null) ?? []).map((p) => [p.id, p.display_name])
  );

  // Paid quantities per product and size in one order window.
  function sizeReport(windowId: string) {
    const paidIds = new Set(
      orders.filter((o) => o.window_id === windowId && (o.status === "paid" || o.status === "picked_up")).map((o) => o.id)
    );
    const counts = new Map<string, number>();
    for (const i of items.filter((i) => paidIds.has(i.order_id))) {
      const key = `${i.product_id}|${i.size}`;
      counts.set(key, (counts.get(key) ?? 0) + i.quantity);
    }
    return [...counts.entries()]
      .map(([key, quantity]) => {
        const [productId, size] = key.split("|");
        return { product: productById.get(productId)?.name ?? "Item", size, quantity };
      })
      .sort((a, b) => a.product.localeCompare(b.product) || a.size.localeCompare(b.size));
  }

  const now = Date.now();
  const toHandOut = orders.filter((o) => o.status === "paid" || o.status === "pending");

  return (
    <div className="min-h-screen p-8 max-w-2xl flex flex-col gap-8">
      <div>
        <Link href="/apparel" className="text-sm text-gray-500 hover:underline">
          ← Apparel
        </Link>
        <h1 className="text-2xl font-bold mt-4">Manage apparel</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Orders to hand out ({toHandOut.length})</h2>
        {toHandOut.length === 0 && <p className="text-sm text-gray-500">Nothing waiting.</p>}
        {toHandOut.map((o) => (
          <div key={o.id} className="rounded-lg border-2 border-gray-200 p-3 flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {nameById.get(o.for_rower_id ?? o.buyer_id) ?? "Member"}
                {o.for_rower_id && o.for_rower_id !== o.buyer_id && (
                  <span className="text-gray-500"> (ordered by {nameById.get(o.buyer_id) ?? "a parent"})</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {items
                  .filter((i) => i.order_id === o.id)
                  .map((i) => `${i.quantity} × ${productById.get(i.product_id)?.name ?? "Item"}${i.size ? ` (${i.size})` : ""}`)
                  .join(", ")}{" "}
                · {formatMoney(o.total_cents)} · {o.status === "paid" ? "paid" : "not paid yet"}
                {o.window_id ? " · group order" : " · from stock"}
              </p>
            </div>
            <OrderActions id={o.id} status={o.status} canTakePayment={canTakePayment} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Order windows</h2>
        {windows.map((w) => {
          const open = Date.parse(w.closes_at) >= now && Date.parse(w.opens_at) <= now;
          const report = sizeReport(w.id);
          return (
            <div key={w.id} className="rounded-lg border-2 border-gray-200 p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{w.title}</p>
                  <p className="text-xs text-gray-500">
                    {open ? "Open" : "Closed"} · last day {new Date(w.closes_at).toLocaleDateString()} ·{" "}
                    {windowProducts
                      .filter((wp) => wp.window_id === w.id)
                      .map((wp) => productById.get(wp.product_id)?.name)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                {open && <CloseWindowButton id={w.id} />}
              </div>
              {report.length > 0 ? (
                <table className="text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="font-medium">Item</th>
                      <th className="font-medium">Size</th>
                      <th className="font-medium text-right">Qty (paid)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.map((r) => (
                      <tr key={`${r.product}|${r.size}`}>
                        <td>{r.product}</td>
                        <td>{r.size || "—"}</td>
                        <td className="text-right">{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-gray-500">No paid orders yet.</p>
              )}
            </div>
          );
        })}
        <NewOrderWindowForm products={products.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Items</h2>
        {products.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border-2 p-3 flex flex-col gap-2 ${p.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {p.name} <span className="text-gray-600">{formatMoney(p.price_cents)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {p.sizes.length ? p.sizes.join(", ") : "One size"}
                  {p.in_stock_item ? " · kept in stock" : " · order windows only"}
                  {!p.active && " · hidden"}
                </p>
              </div>
              <ProductActions id={p.id} active={p.active} />
            </div>
            {p.in_stock_item && (
              <StockEditor
                productId={p.id}
                rows={(p.sizes.length ? p.sizes : [""]).map((size) => ({
                  size,
                  quantity: stock.find((s) => s.product_id === p.id && s.size === size)?.quantity ?? 0,
                }))}
              />
            )}
          </div>
        ))}
        <NewProductForm />
      </section>
    </div>
  );
}
