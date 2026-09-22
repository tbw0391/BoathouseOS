"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChat } from "./actions";
import type { Profile } from "@/lib/database.types";

export type NewChatOther = Pick<Profile, "id" | "display_name">;

export function NewChatForm({ others }: { others: NewChatOther[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const { groupId } = await createChat(formData);
        router.push(`/messages/${groupId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-[#404040] text-white border-2 border-[#022e5d] text-sm px-3 py-2"
      >
        New message
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border rounded-lg p-4 flex flex-col gap-3 max-w-md"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">New message</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>

      <input
        name="group_name"
        placeholder="Group name (optional, for group chats)"
        className="border rounded px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
      />

      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border rounded p-2">
        {others.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="member_ids" value={p.id} />
            {p.display_name}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Starting..." : "Start chat"}
      </button>
    </form>
  );
}
