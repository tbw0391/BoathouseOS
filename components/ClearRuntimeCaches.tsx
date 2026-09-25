"use client";

import { useEffect } from "react";

// Rendered only on signed-out pages (middleware sends signed-in users away),
// so drop the service worker's runtime caches: visited pages and Supabase
// responses would otherwise keep member data on a shared device. The
// precache (app shell, icons) holds nothing personal and stays.
export function ClearRuntimeCaches() {
  useEffect(() => {
    if (!("caches" in window)) return;
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !n.startsWith("workbox-precache")).map((n) => caches.delete(n)))
      )
      .catch(() => {});
  }, []);
  return null;
}
