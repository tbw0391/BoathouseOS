"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { dismissNotice } from "@/app/notices/actions";

export function DismissNoticeButton({ noticeId }: { noticeId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Dismiss"
      disabled={isPending}
      onClick={() => startTransition(() => dismissNotice(noticeId))}
      className="self-start text-gray-400 hover:text-gray-700 disabled:opacity-50"
    >
      <X className="w-5 h-5" />
    </button>
  );
}
