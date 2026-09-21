import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { getUnreadChatCount } from "@/lib/chat";
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

export const viewport: Viewport = {
  themeColor: "#022e5d",
};

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

  let photoUrl: string | null = null;
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("photo_url")
      .eq("id", user.id)
      .single();
    photoUrl = (profileData as { photo_url: string | null } | null)?.photo_url ?? null;
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header unreadCount={unreadCount} userId={user?.id ?? null} photoUrl={photoUrl} />
        {children}
      </body>
    </html>
  );
}
