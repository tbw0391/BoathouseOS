export interface StoreItem {
  title: string;
  price: string;
  url: string;
  image_url: string;
}

export function parseStoreItems(raw: string | null): StoreItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        price: String(item.price ?? "").trim(),
        url: String(item.url ?? "").trim(),
        image_url: String(item.image_url ?? "").trim(),
      }))
      .filter((item) => item.title && item.url);
  } catch {
    return [];
  }
}
