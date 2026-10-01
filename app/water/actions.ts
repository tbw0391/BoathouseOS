"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clubMemberIds, sendPush } from "@/lib/push";
import { clubDateKey } from "@/lib/raceDay";
import {
  PRACTICE_CALL_LABELS,
  WATER_SETTINGS_KEY,
  WIND_DIRECTIONS,
  callConditionsLine,
  type WaterSettings,
} from "@/lib/waterConditions";
import { UserError, tryAction } from "@/lib/userError";

async function requireRole(roles: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (!role || !roles.includes(role)) throw new UserError("Only coaches and admins can do this.");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/water");
  revalidatePath("/");
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Club settings are admin-only (RLS).
export async function saveWaterSettings(formData: FormData) {
  return tryAction(async () => {
    const { supabase } = await requireRole(["admin"]);
    const site = String(formData.get("gaugeSite") ?? "").trim();
    if (site && !/^\d{8,15}$/.test(site)) throw new UserError("A USGS site number is 8 to 15 digits, like 03049500.");
    const settings: WaterSettings = {
      gaugeSite: site || null,
      flowCautionCfs: num(formData.get("flowCautionCfs")),
      flowStopCfs: num(formData.get("flowStopCfs")),
      heightCautionFt: num(formData.get("heightCautionFt")),
      heightStopFt: num(formData.get("heightStopFt")),
      combinedCautionF: num(formData.get("combinedCautionF")),
      combinedStopF: num(formData.get("combinedStopF")),
      windCautionMph: num(formData.get("windCautionMph")),
      windStopMph: num(formData.get("windStopMph")),
    };
    const { error } = await supabase
      .from("club_settings")
      .upsert({ key: WATER_SETTINGS_KEY, value: JSON.stringify(settings) }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);
    refresh();
  });
}

export type CallConditions = {
  waterTempF: number | null;
  airTempF: number | null;
  windMph: number | null;
  windDir: string | null;
};

export async function makePracticeCall(status: string, note: string, conditions: CallConditions) {
  return tryAction(async () => {
    const { supabase, user } = await requireRole(["coach", "admin"]);
    if (!(status in PRACTICE_CALL_LABELS)) throw new UserError("Pick a call.");
    const cleanNote = note.trim().slice(0, 300) || null;
    const inRange = (v: number | null, lo: number, hi: number) => (v != null && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
    const row = {
      water_temp_f: inRange(conditions.waterTempF, 25, 100),
      air_temp_f: inRange(conditions.airTempF, -20, 120),
      wind_mph: inRange(conditions.windMph, 0, 80),
      wind_dir: (WIND_DIRECTIONS as readonly string[]).includes(conditions.windDir ?? "") ? conditions.windDir : null,
    };
    const { error } = await supabase.from("practice_calls").upsert({
      practice_date: clubDateKey(new Date()),
      status,
      note: cleanNote,
      ...row,
      called_by: user.id,
      called_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    const line = callConditionsLine(row);
    await sendPush(await clubMemberIds(user.id), {
      kind: "practice_call",
      title: `Today: ${PRACTICE_CALL_LABELS[status]}`,
      body: [cleanNote, line].filter(Boolean).join("\n") || "Tap for today's water conditions.",
      url: "/water",
      tag: "practice-call",
    });
    refresh();
  });
}

export async function startLightningHold() {
  return tryAction(async () => {
    const { supabase, user } = await requireRole(["coach", "admin"]);
    const { data: open } = await supabase.from("lightning_holds").select("id").is("cleared_at", null).limit(1);
    if ((open as { id: string }[] | null)?.length) {
      const again = await strikeAgain();
      if (!again.ok) throw new UserError(again.error);
      return;
    }
    const { error } = await supabase.from("lightning_holds").insert({ started_by: user.id });
    if (error) throw new Error(error.message);
    await sendPush(await clubMemberIds(user.id), {
      kind: "lightning_hold",
      title: "⚡ Lightning: off the water now",
      body: "All boats head to the nearest safe landing. Wait 30 minutes after the last thunder.",
      url: "/water",
      tag: "lightning",
    });
    refresh();
  });
}

// Thunder or lightning again: the 30 minutes start over.
export async function strikeAgain() {
  return tryAction(async () => {
    const { supabase } = await requireRole(["coach", "admin"]);
    const { error } = await supabase
      .from("lightning_holds")
      .update({ last_strike_at: new Date().toISOString() })
      .is("cleared_at", null);
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function clearLightningHold() {
  return tryAction(async () => {
    const { supabase, user } = await requireRole(["coach", "admin"]);
    const { error } = await supabase
      .from("lightning_holds")
      .update({ cleared_at: new Date().toISOString(), cleared_by: user.id })
      .is("cleared_at", null);
    if (error) throw new Error(error.message);
    await sendPush(await clubMemberIds(user.id), {
      kind: "lightning_hold",
      title: "Lightning hold over",
      body: "The coaches have given the all clear.",
      url: "/water",
      tag: "lightning",
    });
    refresh();
  });
}
