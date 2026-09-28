import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ServiceWorkerUpdater } from "@/components/ServiceWorkerUpdater";
import { TermsGate } from "@/components/TermsGate";
import { TERMS_REQUIRED, TERMS_VERSION } from "@/lib/terms";
import { isDemoEmail } from "@/lib/demoAccount";
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
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("photo_url")
      .eq("id", user.id)
      .single();
    photoUrl = (profileData as { photo_url: string | null } | null)?.photo_url ?? null;
  }

  // Approved members who haven't agreed to the current Terms. Queried on its
  // own so a missing column (migration not applied yet) just skips the gate.
  let needsTerms = false;
  if (TERMS_REQUIRED && user && !isDemoEmail(user.email)) {
    const { data: termsData, error: termsError } = await supabase
      .from("profiles")
      .select("terms_version, approved_at")
      .eq("id", user.id)
      .single();
    const terms = termsData as { terms_version: string | null; approved_at: string | null } | null;
    needsTerms = !termsError && !!terms?.approved_at && terms.terms_version !== TERMS_VERSION;
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
        <BottomNav userId={user?.id ?? null} />
        {needsTerms && <TermsGate />}
      </body>
    </html>
  );
}
