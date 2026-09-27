import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ServiceWorkerUpdater } from "@/components/ServiceWorkerUpdater";
import { createClient } from "@/lib/supabase/server";
import { getUnreadChatCount } from "@/lib/chat";
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
  title: "BoathouseOS",
  description: "Rowing club management — roster, schedule, lineups, volunteers, and messaging.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BoathouseOS",
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
  const unreadCount = user ? await getUnreadChatCount(user.id) : null;
  const demoClub = findDemoClub((await cookies()).get(DEMO_CLUB_COOKIE)?.value);

  let photoUrl: string | null = null;
  let canUseOnWater = false;
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("photo_url, role")
      .eq("id", user.id)
      .single();
    const profile = profileData as { photo_url: string | null; role: string } | null;
    photoUrl = profile?.photo_url ?? null;
    // On the Water is for coxswains (tracking) and coaches/admins (the map).
    canUseOnWater = ["coxswain", "coach", "admin"].includes(profile?.role ?? "");
  }

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
        <Header
          unreadCount={unreadCount}
          userId={user?.id ?? null}
          photoUrl={photoUrl}
          clubBlade={demoClub?.blade ?? null}
        />
        <PullToRefresh>
          <div className="pb-16">{children}</div>
        </PullToRefresh>
        <BottomNav userId={user?.id ?? null} showOnWater={canUseOnWater} />
      </body>
    </html>
  );
}
