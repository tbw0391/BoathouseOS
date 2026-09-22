"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StoreItem } from "@/lib/storeItems";
import { updateFeaturedItems } from "./actions";

const EMPTY_ITEM: StoreItem = { title: "", price: "", url: "", image_url: "" };

export function FeaturedItemsForm({ currentItems }: { currentItems: StoreItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<StoreItem[]>(currentItems.length ? currentItems : [EMPTY_ITEM]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateItem(index: number, field: keyof StoreItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, EMPTY_ITEM]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("items", JSON.stringify(items));
        await updateFeaturedItems(formData);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-4 max-w-lg">
      <h2 className="text-sm font-medium">Featured items (shown on the home page banner)</h2>
      {items.map((item, i) => (
        <div key={i} className="border rounded-lg p-3 flex flex-col gap-2">
          <input
            placeholder="Item name"
            value={item.title}
            onChange={(e) => updateItem(i, "title", e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Price (optional)"
            value={item.price}
            onChange={(e) => updateItem(i, "price", e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Link URL"
            value={item.url}
            onChange={(e) => updateItem(i, "url", e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Image URL (optional)"
            value={item.image_url}
            onChange={(e) => updateItem(i, "image_url", e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            className="self-start text-xs text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="self-start text-sm text-[var(--color-primary)] hover:underline"
      >
        + Add item
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="self-start bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save featured items"}
      </button>
    </div>
  );
}
