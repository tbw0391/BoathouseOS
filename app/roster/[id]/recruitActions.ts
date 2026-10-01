"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanRecruitFields } from "@/lib/recruiting";
import { UserError, tryAction } from "@/lib/userError";

const text = (formData: FormData, name: string, max: number) => {
  const v = String(formData.get(name) ?? "").trim();
  if (v.length > max) throw new UserError(`Keep it under ${max} characters.`);
  return v || null;
};

// The athlete's (or their parent's) college recruiting listing (0121). The
// database lets only them write it, and a trigger records a parent's
// approval or clears it when the athlete changes what's shown.
export async function saveRecruitListing(formData: FormData) {
  return tryAction(async () => {
    const profileId = String(formData.get("profile_id") ?? "");
    const videoUrl = text(formData, "video_url", 500);
    if (videoUrl && !/^https:\/\//.test(videoUrl)) throw new UserError("The video link should start with https://");

    const supabase = await createClient();
    const { error } = await supabase.from("recruit_listings").upsert(
      {
        profile_id: profileId,
        shown: formData.get("shown") === "on",
        fields: cleanRecruitFields(formData.getAll("field")),
        height: text(formData, "height", 20),
        gpa: text(formData, "gpa", 20),
        intended_major: text(formData, "intended_major", 100),
        about: text(formData, "about", 2000),
        video_url: videoUrl,
        // Only counts when a parent saves (the trigger decides).
        parent_approved_at: formData.get("parent_approves") === "on" ? new Date().toISOString() : null,
      },
      { onConflict: "profile_id" }
    );
    if (error) {
      if (error.code === "42501") throw new UserError("Only the athlete or their parent can change this.");
      throw new Error(error.message);
    }
    revalidatePath(`/roster/${profileId}`);
  });
}
