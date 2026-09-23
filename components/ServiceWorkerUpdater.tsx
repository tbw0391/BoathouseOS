"use client";

import { useEffect } from "react";

// The PWA service worker (next-pwa, skipWaiting + clientsClaim) can swap in
// a new version silently while the app is already open, but nothing ever
// reloaded the page to use it — the only way to see new content was to
// force-quit and relaunch. This reloads once the new worker takes control,
// and actively checks for an update whenever the app comes back to the
// foreground, since an installed PWA can sit backgrounded for days without
// the browser ever re-checking for a new deploy on its own.
export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloaded = false;
    function onControllerChange() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    function checkForUpdate() {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") checkForUpdate();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", checkForUpdate);
    checkForUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return null;
}
