import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { DemoClubBar } from "@/components/DemoClubBar";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ServiceWorkerUpdater } from "@/components/ServiceWorkerUpdater";
import { createClient } from "@/lib/supabase/server";
import { getThemeColors } from "@/lib/theme";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BoatHouseOS",
  description: "Rowing club management — roster, schedule, lineups, volunteers, and messaging.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BoatHouseOS",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemeColors();
  return {
    themeColor: theme.primary,
    viewportFit: "cover",
  };
}

const GLOBAL_ADMIN_BACKGROUND = "#fed7aa";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const theme = await getThemeColors();
  const { data: isGlobalAdmin } = user ? await supabase.rpc("is_global_admin") : { data: false };
  const demoClub = user ? findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value) : null;

  const themeStyle = {
    "--color-primary": theme.primary,
    "--color-secondary": theme.secondary,
    "--color-accent": theme.accent,
    // Light orange for the global admin account, so it's obvious at a
    // glance not to hand this device to a visitor.
    "--background": isGlobalAdmin ? GLOBAL_ADMIN_BACKGROUND : theme.background,
  } as React.CSSProperties;

  return (
    <html lang="en" style={themeStyle}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerUpdater />
        {demoClub && <DemoClubBar name={demoClub.name} blade={demoClub.blade} />}
        <PullToRefresh>
          <div className="pb-16">{children}</div>
        </PullToRefresh>
        <BottomNav userId={user?.id ?? null} />
      </body>
    </html>
  );
}
