"use client";

import { useCallback, useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  biometricName,
  forgetPasskeyHere,
  passkeyCancelled,
  passkeyErrorMessage,
  passkeysSupported,
  rememberPasskeyHere,
} from "@/lib/passkey";

const DISMISSED_KEY = "passkey-prompt-dismissed";

type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Sign in with Face ID / fingerprint. On Home: a one-time prompt for members
// with none set up. On their own profile: the devices they've set up, add
// this one, remove old ones. Hidden in the demo, on browsers without
// passkeys, and while passkeys are off for the project.
export function PasskeyCard({ variant }: { variant: "home" | "profile" }) {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("Face ID");
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justTurnedOn, setJustTurnedOn] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().auth.passkey.list();
    if (error) return false;
    setPasskeys(data ?? []);
    return true;
  }, []);

  useEffect(() => {
    if (!passkeysSupported()) return;
    setName(biometricName());
    setDismissed(readDismissed());
    let cancelled = false;
    load().then((ok) => !cancelled && ok && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function turnOn() {
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.registerPasskey();
    if (error) {
      setBusy(false);
      if (!passkeyCancelled(error)) setError(passkeyErrorMessage(error, name));
      return;
    }
    rememberPasskeyHere();
    await load();
    setBusy(false);
    setJustTurnedOn(true);
  }

  async function remove(id: string) {
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.passkey.delete({ passkeyId: id });
    if (error) setError(passkeyErrorMessage(error, name));
    setConfirmRemove(null);
    if (passkeys.length === 1 && !error) forgetPasskeyHere();
    await load();
    setBusy(false);
  }

  function notNow() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // private browsing: it just comes back next visit
    }
    setDismissed(true);
  }

  if (!ready) return null;

  if (variant === "home") {
    if (justTurnedOn) {
      return (
        <div className="w-full flex items-center gap-2 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 text-sm font-medium">
          <ScanFace className="w-5 h-5 shrink-0" />
          {name} is on. Next time, sign in with {name} instead of your password.
        </div>
      );
    }
    if (passkeys.length > 0 || dismissed) return null;
    return (
      <div className="w-full flex flex-col gap-2 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ScanFace className="w-5 h-5 shrink-0" />
          Sign in with {name} next time, instead of your password?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
          >
            {busy ? "Turning on..." : `Turn on ${name}`}
          </button>
          <button
            type="button"
            onClick={notNow}
            disabled={busy}
            className="rounded px-3 py-2 text-gray-500 hover:underline disabled:opacity-50"
          >
            Not now
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-lg rounded-lg border-2 border-gray-200 p-4 flex flex-col gap-3">
      <h2 className="font-semibold flex items-center gap-2">
        <ScanFace className="w-5 h-5" aria-hidden />
        Sign in with {name}
      </h2>
      {passkeys.length === 0 ? (
        <p className="text-sm text-gray-600">
          Skip typing your password: sign in with {name} on this device. Your password still works too.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{p.friendly_name || "Passkey"}</span>
                <span className="block text-xs text-gray-500">
                  Added {shortDate(p.created_at)}
                  {p.last_used_at && ` · last used ${shortDate(p.last_used_at)}`}
                </span>
              </span>
              {confirmRemove === p.id ? (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={busy}
                  className="text-sm text-red-600 border-2 border-red-300 rounded px-3 py-1 disabled:opacity-50"
                >
                  Tap again to remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(p.id)}
                  disabled={busy}
                  className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
        >
          {busy ? "Working..." : passkeys.length === 0 ? `Turn on ${name}` : "Set up on this device too"}
        </button>
      </div>
      {justTurnedOn && <p className="text-sm text-green-700">Done. Next time, sign in with {name}.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
