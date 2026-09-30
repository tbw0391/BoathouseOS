"use client";

import { createContext, useContext } from "react";
import Image from "next/image";

// The club whose address this is, for the logos around the app (see
// lib/clubBranding.ts). `iconSrc` is null when the club has no icon of its
// own, and everything falls back to BoathouseOS's.
export type SiteBranding = { appName: string; iconSrc: string | null };

const BrandingContext = createContext<SiteBranding>({ appName: "BoathouseOS", iconSrc: null });

export function BrandingProvider({ value, children }: { value: SiteBranding; children: React.ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}

// The big logo on the sign-in, sign-up and password pages.
export function ClubLogo() {
  const { appName, iconSrc } = useBranding();
  if (iconSrc) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} alt="" width={128} height={128} className="w-32 h-32" />
        <p className="text-xl font-bold text-[var(--color-primary)]">{appName}</p>
      </div>
    );
  }
  return (
    <Image
      src="/branding/logo-full.png"
      alt="BoathouseOS"
      width={789}
      height={205}
      priority
      className="w-64 h-auto mx-auto"
    />
  );
}
