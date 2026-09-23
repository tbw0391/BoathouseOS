import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { createClient } from "@/lib/supabase/server";
import { getUnreadChatCount } from "@/lib/chat";
import { getThemeColors } from "@/lib/theme";
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
  title: "W-Crew-app",
  description: "Westerville Rowing Club — roster, schedule, lineups, volunteers, and messaging.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "W-Crew",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemeColors();
  return {
    themeColor: theme.primary,
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = user ? await getUnreadChatCount(user.id) : null;
  const theme = await getThemeColors();

  let photoUrl: string | null = null;
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("photo_url")
      .eq("id", user.id)
      .single();
    photoUrl = (profileData as { photo_url: string | null } | null)?.photo_url ?? null;
  }

  const themeStyle = {
    "--color-primary": theme.primary,
    "--color-secondary": theme.secondary,
    "--color-accent": theme.accent,
    "--background": theme.background,
  } as React.CSSProperties;

  return (
    <html lang="en" style={themeStyle}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header unreadCount={unreadCount} userId={user?.id ?? null} photoUrl={photoUrl} />
        <PullToRefresh>
          <div className="pb-16">{children}</div>
        </PullToRefresh>
        <BottomNav userId={user?.id ?? null} />
      </body>
    </html>
  );
}
