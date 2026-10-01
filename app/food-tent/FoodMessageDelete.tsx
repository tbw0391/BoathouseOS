"use client";

import { useTransition } from "react";
import { deleteFoodTentMessage } from "./actions";

export function FoodMessageDelete({ messageId }: { messageId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await deleteFoodTentMessage(messageId)))}
      className="text-xs text-red-600 hover:underline disabled:opacity-50 shrink-0"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
