import { createAdminClient } from "@/lib/supabase/admin";
import { validTwilioSignature } from "@/lib/sms";

// Twilio calls this when someone texts the club number (set it as the
// number's "A message comes in" webhook, HTTP POST). STOP-type replies
// record the opt-out; START-type replies turn texts back on for anyone who
// had agreed before. Twilio itself answers STOP/START/HELP with its standard
// replies and blocks texts to opted-out numbers, so this only keeps our
// records in step. Signed out, so middleware skips it.
const STOP = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout"];
const START = ["start", "unstop", "yes"];

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  // Twilio signs the exact address it called, which can be any club's
  // address on production (or the demo's), so check against that.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "www.boathouseos.app";
  const calledUrl = `https://${host}${new URL(request.url).pathname}`;
  if (!validTwilioSignature(calledUrl, params, request.headers.get("x-twilio-signature") ?? "")) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const from = params.From ?? "";
  const word = (params.Body ?? "").trim().toLowerCase();
  const now = new Date().toISOString();
  const admin = createAdminClient();
  if (STOP.includes(word)) {
    await admin.from("sms_consents").update({ opted_out_at: now, updated_at: now }).eq("phone", from);
  } else if (START.includes(word)) {
    await admin.from("sms_consents").update({ opted_out_at: null, updated_at: now }).eq("phone", from);
  }

  // Empty TwiML: no extra reply beyond Twilio's own.
  return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}
