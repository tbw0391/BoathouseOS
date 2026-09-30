import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { ICON_SIZES, siteClubBranding } from "@/lib/clubBranding";

// The home-screen icon for the club whose address this is, at 180 (iPhone),
// 192 or 512 pixels. Clubs without their own icon get BoathouseOS's.
export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!(ICON_SIZES as readonly number[]).includes(size)) return new Response("Not found", { status: 404 });

  const branding = await siteClubBranding();
  if (branding.iconPath) {
    const { data } = await createAdminClient().storage.from("club-icons").download(branding.iconPath);
    if (data) {
      const png = await sharp(Buffer.from(await data.arrayBuffer())).resize(size, size).png().toBuffer();
      return new Response(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }
  }
  return Response.redirect(new URL(`/icons/icon-${size === 512 ? 512 : 192}.png`, request.url), 307);
}
