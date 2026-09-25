"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const CODES = [
  {
    path: "/login",
    title: "Try BoatHouseOS",
    caption: "Scan to try the demo on your own phone",
  },
  {
    path: "/interest",
    title: "Interested?",
    caption: "Scan to leave your email or phone and we'll let you know when it's available",
  },
];

export function QrCodes() {
  // Read after mount so server and client render the same markup; the codes
  // point at whichever site this page is opened on.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!origin) return null;

  return (
    <>
      {origin.includes("localhost") && (
        <p className="text-sm text-red-600 mb-4 print:hidden">
          You&apos;re on {origin}, so these codes won&apos;t work on other phones. Open this page on
          the live site before printing.
        </p>
      )}
      <div className="grid gap-8 sm:grid-cols-2">
        {CODES.map((c) => (
          <div
            key={c.path}
            className="bg-white border-2 border-[var(--color-primary)] rounded-lg p-6 flex flex-col items-center gap-3 text-center break-inside-avoid"
          >
            <h2 className="text-xl font-bold">{c.title}</h2>
            <QRCodeSVG value={`${origin}${c.path}`} size={220} marginSize={2} />
            <p className="text-sm">{c.caption}</p>
            <p className="text-xs text-gray-500 break-all">{`${origin}${c.path}`}</p>
          </div>
        ))}
      </div>
      <button
        onClick={() => window.print()}
        className="mt-6 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium print:hidden"
      >
        Print
      </button>
    </>
  );
}
