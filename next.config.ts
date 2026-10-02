import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Source brand art the app never loads (the derived logo/mark files are
  // what's used); Concept.png alone is 2MB, downloaded on every install.
  publicExcludes: [
    "!noprecache/**/*",
    "!branding/Concept.png",
    "!branding/Logo.png",
    "!branding/icon.png",
  ],
  workboxOptions: {
    skipWaiting: true,
  },
});

// Content-Security-Policy is set in middleware.ts instead of here, since it
// needs a fresh per-request nonce for Next's inline hydration scripts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation stays allowed for our own pages: the On-Water tracker needs it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Uploaded photos and avatars (see components/StorageImage.tsx). Upload paths
// are unique per file, so a resized copy never goes stale.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  // Room for a club's logo upload on /admin (Vercel caps requests at 4.5MB).
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  // The HDF5 reader for satellite lightning files (lib/lightning.ts) loads
  // its own WebAssembly; leave it unbundled.
  serverExternalPackages: ["h5wasm"],
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withPWA(nextConfig);
