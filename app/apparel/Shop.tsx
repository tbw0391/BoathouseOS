"use client";

import { useState, useTransition } from "react";
import { placeOrder, type CartLine } from "./actions";
import { CONVENIENCE_FEE_LABEL, PLATFORM_FEE_BPS, formatMoney } from "@/lib/payments";
import type { Product } from "@/lib/database.types";
import { unwrap } from "@/lib/userError";

// One shop section: an open order window, or the in-stock items. Tap a size,
// set how many, then check out for yourself or one of your rowers.
export function Shop({
  windowId,
  products,
  stock,
  rowers,
  online,
}: {
  windowId: string | null;
  products: Product[];
  // In-stock sections only: how many are left, keyed "productId:size".
  stock: Record<string, number> | null;
  rowers: { id: string; display_name: string }[];
  online: boolean;
}) {
  const [sizeByProduct, setSizeByProduct] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [forRowerId, setForRowerId] = useState<string>(rowers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [p.id, p]));
  const left = (productId: string, size: string) => (stock ? stock[`${productId}:${size}`] ?? 0 : Infinity);
  const inCart = (productId: string, size: string) =>
    cart.find((l) => l.productId === productId && l.size === size)?.quantity ?? 0;
  const total = cart.reduce((s, l) => s + (byId.get(l.productId)?.price_cents ?? 0) * l.quantity, 0);

  function add(product: Product) {
    const size = product.sizes.length ? sizeByProduct[product.id] : "";
    if (size === undefined) {
      setError(`Pick a size for ${product.name}.`);
      return;
    }
    if (inCart(product.id, size) + 1 > left(product.id, size)) {
      setError(`No more ${product.name}${size ? ` in ${size}` : ""} in stock.`);
      return;
    }
    setError(null);
    setCart((c) => {
      const existing = c.find((l) => l.productId === product.id && l.size === size);
      return existing
        ? c.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
        : [...c, { productId: product.id, size, quantity: 1 }];
    });
  }

  function remove(line: CartLine) {
    setCart((c) =>
      c.flatMap((l) => (l === line ? (l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []) : [l]))
    );
  }

  function checkout() {
    setError(null);
    startTransition(async () => {
      try {
        const url = unwrap(await placeOrder({ windowId, forRowerId: forRowerId || null, lines: cart }));
        if (url) {
          window.location.assign(url);
        } else {
          setCart([]);
          setMessage("Order placed. Pay the treasurer by cash or check; online payment is coming soon.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {products.map((p) => (
        <div key={p.id} className="rounded-lg border-2 border-gray-200 p-3 flex gap-3">
          {p.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image_url} alt="" className="w-20 h-20 rounded object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div>
              <p className="font-medium">
                {p.name} <span className="text-gray-600">{formatMoney(p.price_cents)}</span>
              </p>
              {p.description && <p className="text-xs text-gray-500">{p.description}</p>}
            </div>
            {p.sizes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.sizes.map((size) => {
                  const soldOut = left(p.id, size) <= 0;
                  const picked = sizeByProduct[p.id] === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={soldOut}
                      onClick={() => setSizeByProduct({ ...sizeByProduct, [p.id]: size })}
                      className={`rounded border-2 px-2 py-0.5 text-sm ${
                        picked
                          ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                          : "border-gray-300"
                      } disabled:opacity-30 disabled:line-through`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            )}
            {stock && !p.sizes.length && left(p.id, "") <= 0 ? (
              <p className="text-xs text-gray-500">Sold out</p>
            ) : (
              <button
                type="button"
                onClick={() => add(p)}
                className="self-start rounded border-2 border-[var(--color-primary)] px-3 py-1 text-sm font-medium"
              >
                Add to cart
              </button>
            )}
          </div>
        </div>
      ))}

      {cart.length > 0 && (
        <div className="rounded-lg border-2 border-green-600 bg-green-50 p-3 flex flex-col gap-2">
          <p className="font-semibold">Your cart</p>
          {cart.map((l) => {
            const p = byId.get(l.productId);
            return (
              <div key={`${l.productId}:${l.size}`} className="flex items-center justify-between text-sm">
                <span>
                  {l.quantity} × {p?.name}
                  {l.size && ` (${l.size})`}
                </span>
                <span className="flex items-center gap-2">
                  {formatMoney((p?.price_cents ?? 0) * l.quantity)}
                  <button type="button" onClick={() => remove(l)} aria-label="Remove one" className="text-gray-500">
                    −
                  </button>
                </span>
              </div>
            );
          })}
          <p className="text-sm font-semibold border-t pt-2">Total {formatMoney(total)}</p>
          {online && (
            <p className="text-xs text-gray-500">
              Plus a {PLATFORM_FEE_BPS / 100}% {CONVENIENCE_FEE_LABEL.toLowerCase()} when paying by card.
            </p>
          )}
          {rowers.length > 1 && (
            <label className="text-sm flex items-center gap-2">
              For
              <select
                value={forRowerId}
                onChange={(e) => setForRowerId(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                {rowers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={checkout}
            className="self-start rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? "One moment..." : online ? `Check out ${formatMoney(total)}` : "Place order"}
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
