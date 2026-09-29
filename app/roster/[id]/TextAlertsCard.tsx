"use client";

import { useState, useTransition } from "react";
import { MessageSquareText } from "lucide-react";
import { SMS_CONSENT_TEXT, formatUsPhone } from "@/lib/smsRules";
import { saveTextAlerts, turnOffTextAlerts } from "./actions";

// Opt in to (or out of) text alerts on your own profile. The consent box
// and its exact wording are what carriers check for.
export function TextAlertsCard({ phone, canOptIn }: { phone: string | null; canOptIn: boolean }) {
  const [number, setNumber] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="mt-6 max-w-lg rounded-lg border-2 border-gray-200 p-4 flex flex-col gap-3">
      <h2 className="font-semibold flex items-center gap-2">
        <MessageSquareText className="w-5 h-5" aria-hidden />
        Text alerts
      </h2>

      {phone ? (
        <>
          <p className="text-sm">
            On for <strong>{formatUsPhone(phone)}</strong>: lightning holds, today&apos;s practice
            changes, and race launch times. Reply STOP to any text to stop them.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(turnOffTextAlerts)}
            className="self-start text-sm border-2 border-gray-300 rounded px-3 py-2 disabled:opacity-50"
          >
            {isPending ? "Turning off..." : "Turn off text alerts"}
          </button>
        </>
      ) : canOptIn ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveTextAlerts(number, agreed));
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-gray-600">
            Get a text for lightning holds, today&apos;s practice changes, and race launch times.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Mobile number</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="(614) 555-1234"
              className="border rounded px-3 py-2 w-48"
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0"
            />
            <span>
              {SMS_CONSENT_TEXT} See our <a href="/terms" className="underline">Terms</a> and{" "}
              <a href="/privacy" className="underline">Privacy policy</a>.
            </span>
          </label>
          <button
            type="submit"
            disabled={isPending || !agreed || !number.trim()}
            className="self-start bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Turn on text alerts"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-600">
          Texts for rowers under 18 go to their parents. If you&apos;re 18 or older, add your
          birthday (Edit) to turn them on.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
