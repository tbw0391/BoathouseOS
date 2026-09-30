"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const CODES = [
  {
    path: "/welcome",
    title: "Try BoathouseOS",
    caption: "Scan to see what it does and try the demo on your own phone",
  },
  {
    path: "/interest",
    title: "Interested?",
    caption: "Scan to leave your email or phone and we'll let you know when it's available",
  },
];

// `compact` is the smaller, print-free version shown at the bottom of the home page.
export function QrCodes({ compact = false }: { compact?: boolean }) {
  // Read after mount so server and client render the same markup; the codes
  // point at whichever site this page is opened on.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!origin) return null;

  return (
    <>
      {!compact && origin.includes("localhost") && (
        <p className="text-sm text-red-600 mb-4 print:hidden">
          You&apos;re on {origin}, so these codes won&apos;t work on other phones. Open this page on
          the live site before printing.
        </p>
      )}
      <div className={compact ? "w-full max-w-md grid gap-4 grid-cols-2" : "grid gap-8 sm:grid-cols-2"}>
        {CODES.map((c) => (
          <div
            key={c.path}
            className={`bg-white border-2 border-[var(--color-primary)] rounded-lg flex flex-col items-center text-center break-inside-avoid ${compact ? "p-3 gap-2" : "p-6 gap-3"}`}
          >
            <h2 className={compact ? "text-sm font-bold" : "text-xl font-bold"}>{c.title}</h2>
            <QRCodeSVG
              value={`${origin}${c.path}`}
              size={compact ? 140 : 220}
              marginSize={2}
              className={compact ? "w-full h-auto max-w-[140px]" : undefined}
            />
            <p className={compact ? "text-xs" : "text-sm"}>{c.caption}</p>
            {!compact && <p className="text-xs text-gray-500 break-all">{`${origin}${c.path}`}</p>}
          </div>
        ))}
      </div>
      {!compact && (
        <button
          onClick={() => window.print()}
          className="mt-6 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium print:hidden"
        >
          Print
        </button>
      )}
    </>
  );
}
