"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  deletePushSubscription,
  isPushSubscriptionMine,
  savePushSubscription,
  type PushSubscriptionInput,
} from "@/app/notifications/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISSED_KEY = "push-prompt-dismissed";

type State = "loading" | "hidden" | "install-first" | "blocked" | "off" | "dismissed" | "on";

function base64UrlToBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

// Home-page prompt to turn on phone alerts, then a small on/off line once
// decided. Hidden in the demo and when push isn't configured.
export function PushToggle({ isDemo }: { isDemo: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isDemo || !VAPID_PUBLIC_KEY) return setState("hidden");
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return setState(isIos() && !isInstalled() ? "install-first" : "hidden");
    if (Notification.permission === "denied") return setState("blocked");

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        const mine = sub ? await isPushSubscriptionMine(sub.endpoint) : false;
        if (cancelled) return;
        setState(mine ? "on" : readDismissed() ? "dismissed" : "off");
      })
      .catch(() => !cancelled && setState("hidden"));
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  function turnOn() {
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!),
          }));
        await savePushSubscription(sub.toJSON() as PushSubscriptionInput, navigator.userAgent);
        setState("on");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't turn on alerts.");
      }
    });
  }

  function turnOff() {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await deletePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        try {
          localStorage.setItem(DISMISSED_KEY, "1");
        } catch {}
        setState("dismissed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't turn off alerts.");
      }
    });
  }

  function notNow() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setState("dismissed");
  }

  if (state === "loading" || state === "hidden") return null;

  const errorLine = error && <p className="text-xs text-red-600">{error}</p>;

  if (state === "off") {
    return (
      <div className="w-full flex flex-col gap-2 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Bell className="w-5 h-5 shrink-0" />
          Get alerts on this phone for messages, schedule changes, and announcements?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={turnOn}
            disabled={isPending}
            className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
          >
            {isPending ? "Turning on..." : "Turn on alerts"}
          </button>
          <button
            type="button"
            onClick={notNow}
            className="rounded px-3 py-2 text-gray-500 hover:underline"
          >
            Not now
          </button>
        </div>
        {errorLine}
      </div>
    );
  }

  if (state === "install-first") {
    return (
      <p className="w-full flex items-start gap-2 text-xs text-gray-500">
        <Bell className="w-4 h-4 shrink-0" />
        To get alerts on iPhone, tap Share, then &quot;Add to Home Screen&quot;, and open the app
        from there.
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className="w-full flex items-start gap-2 text-xs text-gray-500">
        <BellOff className="w-4 h-4 shrink-0" />
        Alerts are blocked for this app. Allow notifications in your phone or browser settings to
        get them.
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col gap-1 text-xs text-gray-500">
      <p className="flex items-center gap-2">
        {state === "on" ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        Alerts on this phone are {state === "on" ? "on" : "off"}.
        <button
          type="button"
          onClick={state === "on" ? turnOff : turnOn}
          disabled={isPending}
          className="underline disabled:opacity-50"
        >
          {state === "on" ? "Turn off" : "Turn on"}
        </button>
      </p>
      {errorLine}
    </div>
  );
}
