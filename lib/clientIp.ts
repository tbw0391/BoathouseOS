import { headers } from "next/headers";

// Best-effort caller IP for per-IP rate limits on the public forms. Behind
// Vercel, x-forwarded-for's first entry is the real client.
export async function getClientIp() {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}
