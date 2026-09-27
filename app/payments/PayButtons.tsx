"use client";

import { useState, useTransition } from "react";
import { payBill, signUpForCharge } from "./actions";

// Pay-in-full / payment-plan buttons for a season sign-up or an open bill.
// Sends the browser to Stripe's checkout page; if online payments aren't on
// yet, a sign-up still creates the bill and says the treasurer will collect.
export function PayButtons({
  mode,
  chargeId,
  rowerId,
  billId,
  fullLabel,
  planLabel,
  online,
}: {
  mode: "signup" | "pay";
  chargeId?: string;
  rowerId?: string;
  billId?: string;
  fullLabel: string;
  planLabel: string | null;
  online: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function go(plan: "full" | "installments") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const url =
          mode === "signup"
            ? await signUpForCharge(chargeId as string, rowerId as string, plan)
            : await payBill(billId as string, plan);
        if (url) window.location.assign(url);
        else setMessage("You're signed up. The treasurer will let you know how to pay.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (mode === "pay" && !online) {
    return <p className="text-xs text-gray-500">Pay the treasurer by cash or check. Online payment is coming soon.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => go("full")}
          className="rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? "One moment..." : fullLabel}
        </button>
        {planLabel && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => go("installments")}
            className="rounded-lg border-2 border-green-600 text-green-800 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {planLabel}
          </button>
        )}
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
