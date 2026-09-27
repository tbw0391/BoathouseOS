"use client";

import { useRef, useState, useTransition } from "react";
import {
  closeOrderWindow,
  createOrderWindow,
  createProduct,
  setOrderStatus,
  setProductActive,
  setStock,
} from "../actions";

const input = "border rounded px-3 py-2 text-sm";
const primaryButton =
  "self-start rounded bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] px-3 py-2 text-sm disabled:opacity-50";
const small = "text-xs font-medium hover:underline";

const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "Adult XS–XXL", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "Youth S–XL", sizes: ["YS", "YM", "YL", "YXL"] },
  { label: "One size", sizes: [] },
];

export function NewProductForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [sizes, setSizes] = useState<string[]>(SIZE_PRESETS[0].sizes);
  const [inStock, setInStock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="border rounded-lg p-4 flex flex-col gap-3"
      action={(fd) => {
        fd.set("sizes", sizes.join(","));
        setError(null);
        startTransition(async () => {
          try {
            await createProduct(fd);
            formRef.current?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
          }
        });
      }}
    >
      <h3 className="font-medium">New item</h3>
      <input name="name" required placeholder="Name, like Team unisuit" className={input} />
      <input name="price" required inputMode="decimal" placeholder="Price, like 65" className={input} />
      <input name="description" placeholder="Details (optional)" className={input} />
      <input name="image_url" placeholder="Photo link (optional)" className={input} />
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sizes</p>
        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSizes(preset.sizes)}
              className={`rounded-lg border-2 px-3 py-1.5 text-sm ${
                sizes.join() === preset.sizes.join()
                  ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                  : "border-gray-300"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          value={sizes.join(", ")}
          onChange={(e) =>
            setSizes(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="Or type sizes, separated by commas"
          className={input}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="in_stock_item" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
        Kept in stock at the boathouse (set how many below after adding)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={isPending} className={primaryButton}>
        {isPending ? "Adding..." : "Add item"}
      </button>
    </form>
  );
}

export function ProductActions({ id, active }: { id: string; active: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <button type="button" className={small} onClick={() => startTransition(() => setProductActive(id, !active))}>
      {active ? "Hide" : "Show"}
    </button>
  );
}

// How many of each size are on the shelf.
export function StockEditor({ productId, rows }: { productId: string; rows: { size: string; quantity: number }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {rows.map((r) => (
        <label key={r.size} className="flex items-center gap-1 text-sm">
          {r.size || "Qty"}
          <input
            type="number"
            min={0}
            defaultValue={r.quantity}
            onBlur={(e) => {
              const q = Number(e.target.value);
              if (q === r.quantity) return;
              startTransition(async () => {
                try {
                  await setStock(productId, r.size, q);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn't save.");
                }
              });
            }}
            className="border rounded px-2 py-1 text-sm w-16"
          />
        </label>
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function NewOrderWindowForm({ products }: { products: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="border rounded-lg p-4 flex flex-col gap-3"
      action={(fd) => {
        picked.forEach((id) => fd.append("product_ids", id));
        setError(null);
        startTransition(async () => {
          try {
            await createOrderWindow(fd);
            formRef.current?.reset();
            setPicked([]);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
          }
        });
      }}
    >
      <h3 className="font-medium">Open an order</h3>
      <input name="title" required placeholder="Name, like Fall team gear" className={input} />
      <input name="description" placeholder="Details, like delivery in about 4 weeks (optional)" className={input} />
      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Last day to order
        <input type="date" name="closes_on" required className={`${input} text-black`} />
      </label>
      <div className="flex flex-wrap gap-2">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
            className={`rounded-full border-2 px-3 py-1 text-sm ${
              picked.includes(p.id) ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={isPending} className={primaryButton}>
        {isPending ? "Opening..." : "Open order"}
      </button>
    </form>
  );
}

export function CloseWindowButton({ id }: { id: string }) {
  const [, startTransition] = useTransition();
  return (
    <button type="button" className={`${small} text-red-600`} onClick={() => startTransition(() => closeOrderWindow(id))}>
      Close now
    </button>
  );
}

export function OrderActions({ id, status }: { id: string; status: "pending" | "paid" | "picked_up" | "cancelled" }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex gap-3 shrink-0">
      {status === "pending" && (
        <button type="button" className={small} onClick={() => startTransition(() => setOrderStatus(id, "paid"))}>
          Mark paid (cash/check)
        </button>
      )}
      {status === "paid" && (
        <button type="button" className={small} onClick={() => startTransition(() => setOrderStatus(id, "picked_up"))}>
          Picked up
        </button>
      )}
      {(status === "pending" || status === "paid") && (
        <button
          type="button"
          className={`${small} text-red-600`}
          onClick={() => startTransition(() => setOrderStatus(id, "cancelled"))}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
