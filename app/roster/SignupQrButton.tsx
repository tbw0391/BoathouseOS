"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function SignupQrButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const signupUrl = typeof window !== "undefined" ? `${window.location.origin}/signup` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access can fail silently (e.g. no permission); the link is shown either way
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] text-sm px-3 py-2"
      >
        Invite via QR code
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 flex flex-col items-center gap-4 max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-medium">Scan to join BoatHouseOS</h2>
            {signupUrl && <QRCodeSVG value={signupUrl} size={220} />}
            <p className="text-xs text-gray-500 break-all text-center">{signupUrl}</p>
            <div className="flex gap-2 w-full">
              <button
                onClick={copyLink}
                className="flex-1 text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 text-sm bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
