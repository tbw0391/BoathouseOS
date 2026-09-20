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

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header unreadCount={unreadCount} />
        {children}
      </body>
    </html>
  );
}
