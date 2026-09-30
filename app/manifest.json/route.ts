import { siteClubBranding } from "@/lib/clubBranding";
import { getThemeColors } from "@/lib/theme";

// The web app manifest: what a phone calls the app and which icon it puts on
// the home screen, for the club whose address this is.
export async function GET() {
  const [branding, theme] = await Promise.all([siteClubBranding(), getThemeColors()]);
  const v = branding.iconVersion;
  return Response.json(
    {
      name: branding.appName,
      short_name: branding.shortName,
      description: "Rowing club management — roster, schedule, lineups, volunteers, and messaging.",
      start_url: "/",
      display: "standalone",
      background_color: theme.primary,
      theme_color: theme.primary,
      icons: [
        { src: `/club-icon/192?v=${v}`, sizes: "192x192", type: "image/png" },
        { src: `/club-icon/512?v=${v}`, sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } }
  );
}
