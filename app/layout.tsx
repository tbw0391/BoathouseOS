import type { Metadata, Viewport } from "next";
import Image from "next/image";
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
import { siteClubBranding } from "@/lib/clubBranding";
import { BrandingProvider } from "@/components/ClubBranding";
import { DEMO_CLUB_COOKIE, findDemoClub } from "@/lib/demoClubs";
import { cookies, headers } from "next/headers";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { RecruitHeader } from "@/components/RecruitHeader";
import { SplashScreen } from "@/components/SplashScreen";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The app's name and home-screen icon are the club's own (see
// lib/clubBranding.ts), so members' phones show their club.
export async function generateMetadata(): Promise<Metadata> {
  const branding = await siteClubBranding();
  return {
    title: branding.appName,
    description: "Rowing club management — roster, schedule, lineups, volunteers, and messaging.",
    manifest: "/manifest.json",
    icons: { apple: `/club-icon/180?v=${branding.iconVersion}` },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: branding.shortName,
    },
  };
}

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
  // The global admin console (admin.boathouseos.app, or /console on the
  // demo) has its own plain header and none of a club's navigation.
  if ((await headers()).get("x-console") === "1") {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-sky-100`}>
          <ConsoleHeader />
          {children}
        </body>
      </html>
    );
  }

  // College coaches' recruit pages (recruit.boathouseos.app, or /recruit on
  // the demo).
  if ((await headers()).get("x-recruit") === "1") {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}>
          <RecruitHeader />
          {children}
        </body>
      </html>
    );
  }

  // The club's public website (/site) draws its own header; no app chrome.
  if ((await headers()).get("x-site") === "1") {
    const siteTheme = await getThemeColors();
    return (
      <html
        lang="en"
        style={
          {
            "--color-primary": siteTheme.primary,
            "--color-secondary": siteTheme.secondary,
            "--color-accent": siteTheme.accent,
            "--background": "#ffffff",
          } as React.CSSProperties
        }
      >
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-400 print:hidden">
            <span>Powered by</span>
            <Image src="/branding/logo-full.png" alt="BoathouseOS" width={789} height={205} className="h-8 w-auto" />
          </div>
        </body>
      </html>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const theme = await getThemeColors();
  const { data: isGlobalAdmin } = user ? await supabase.rpc("is_global_admin") : { data: false };
  const unreadCount = user ? await getUnreadChatCount(user.id) : null;
  const branding = await siteClubBranding();
  const siteBranding = {
    appName: branding.appName,
    iconSrc: branding.iconPath ? `/club-icon/512?v=${branding.iconVersion}` : null,
  };
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
    // suppressHydrationWarning: the splash script sets data-splash on <html>
    // before React hydrates.
    <html lang="en" style={themeStyle} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SplashScreen iconSrc={siteBranding.iconSrc} appName={siteBranding.appName} />
        <BrandingProvider value={siteBranding}>
          <ServiceWorkerUpdater />
          <Header
            unreadCount={unreadCount}
            userId={user?.id ?? null}
            photoUrl={photoUrl}
            clubBlade={demoClub?.blade ?? null}
          />
          <PullToRefresh>
            <div className="pb-16">
              {children}
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-gray-400 print:hidden">
                <span>Powered by</span>
                <Image src="/branding/logo-full.png" alt="BoathouseOS" width={789} height={205} className="h-8 w-auto" />
              </div>
            </div>
          </PullToRefresh>
          <BottomNav userId={user?.id ?? null} />
          {needsTerms && <TermsGate />}
        </BrandingProvider>
      </body>
    </html>
  );
}
