"use client";

import { useState, useTransition } from "react";
import { uploadWebsiteFile } from "./actions";
import { unwrap } from "@/lib/userError";

// Upload a photo or document for a website page; gives back the line to
// paste into the page's text.
export function FileUploader() {
  const [line, setLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="border rounded-lg p-3 text-sm flex flex-col gap-2">
      <span className="font-medium">Add a photo or document</span>
      <input
        type="file"
        disabled={pending}
        className="text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const data = new FormData();
          data.set("file", file);
          setError(null);
          setLine(null);
          start(async () => {
            try {
              const { url, isImage } = unwrap(await uploadWebsiteFile(data));
              setLine(isImage ? `![](${url})` : `${file.name} (${url})`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't upload that.");
            }
          });
        }}
      />
      {pending && <span className="text-xs text-gray-500">Uploading…</span>}
      {line && (
        <span className="text-xs">
          Paste this line into the text where you want it, on a line of its own:
          <code className="block mt-1 p-2 bg-gray-100 rounded break-all select-all">{line}</code>
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
