"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/database.types";
import { sendMessage, markChatRead } from "../actions";

export function ChatThread({
  groupId,
  currentUserId,
  initialMessages,
  sendersById,
}: {
  groupId: string;
  currentUserId: string;
  initialMessages: Message[];
  sendersById: Record<string, string>;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markChatRead(groupId);

    const supabase = createClient();
    let cancelled = false;

    // Create and register callbacks synchronously so the cleanup function
    // below always has a real channel to remove — if that were deferred
    // until after an awaited call, React Strict Mode's dev-time double
    // effect invocation could run cleanup before the channel existed,
    // leaving a stale subscribed channel with the same topic behind (which
    // then throws "cannot add postgres_changes callbacks after subscribe()"
    // on the next mount).
    const channel = supabase.channel(`messages:${groupId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
      (payload) => {
        const message = payload.new as Message;
        setMessages((prev) => [...prev, message]);
        if (message.sender_id !== currentUserId) {
          markChatRead(groupId);
        }
      }
    );

    // RLS-secured postgres_changes needs the realtime connection's auth token
    // set explicitly — a freshly created browser client (hydrated from SSR
    // cookies) doesn't fire the auth event that normally does this, so
    // without it the subscription silently receives no events.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(formData: FormData) {
    formRef.current?.reset();
    startTransition(async () => {
      await sendMessage(groupId, formData);
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-4">
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && (
                <span className="text-xs text-gray-500">
                  {sendersById[m.sender_id] ?? "Unknown"}
                </span>
              )}
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  mine ? "bg-[#022e5d] text-white" : "bg-gray-100"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form ref={formRef} action={handleSubmit} className="flex gap-2 border-t pt-3">
        <input
          name="body"
          placeholder="Type a message..."
          autoComplete="off"
          required
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
