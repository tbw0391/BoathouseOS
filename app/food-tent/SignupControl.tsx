"use client";

import { useState, useTransition } from "react";
import { signUpForItem, cancelSignup } from "./actions";

export function SignupControl({
  itemId,
  myQuantity,
}: {
  itemId: string;
  myQuantity: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();

  function handleSignUp() {
    setError(null);
    const formData = new FormData();
    formData.set("item_id", itemId);
    formData.set("quantity", String(quantity));
    startTransition(async () => {
      try {
        await signUpForItem(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleCancel() {
    setError(null);
    const formData = new FormData();
    formData.set("item_id", itemId);
    startTransition(async () => {
      try {
        await cancelSignup(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (myQuantity !== null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-green-700">
          You&apos;re bringing {myQuantity}
        </span>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        className="border rounded px-2 py-1 text-sm w-16"
      />
      <button
        onClick={handleSignUp}
        disabled={isPending}
        className="text-sm bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-1 disabled:opacity-50"
      >
        {isPending ? "Signing up..." : "I'll bring this"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
