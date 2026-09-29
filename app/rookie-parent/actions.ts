"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  LEGACY_ROOKIE_PARENT_KEYS,
  ROOKIE_PARENT_SECTIONS_KEY,
  parseRookieParentSections,
  type RookieParentSection,
} from "@/lib/rookieParent";
import { UserError, tryAction } from "@/lib/userError";

// Checks the caller is an admin, applies `change` to the current section
// list and saves the result.
async function editSections(change: (sections: RookieParentSection[]) => RookieParentSection[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("Not signed in.");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((callerProfile as { role: string } | null)?.role !== "admin") {
    throw new UserError("Only admins can edit this page.");
  }

  const { data: settingsData } = await supabase
    .from("club_settings")
    .select("key, value")
    .in("key", [ROOKIE_PARENT_SECTIONS_KEY, ...LEGACY_ROOKIE_PARENT_KEYS]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value]),
  );
  const current = parseRookieParentSections(settingsByKey.get(ROOKIE_PARENT_SECTIONS_KEY), settingsByKey);

  const { error } = await supabase
    .from("club_settings")
    .upsert(
      { key: ROOKIE_PARENT_SECTIONS_KEY, value: JSON.stringify(change(current)) },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/rookie-parent");
}

// Saves a section's title and text; a null id adds a new section at the end.
export async function saveRookieParentSection(id: string | null, title: string, text: string) {
  return tryAction(async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new UserError("Give the section a title.");
    const cleanText = text.trim() || null;

    await editSections((sections) => {
      if (id === null) {
        return [...sections, { id: crypto.randomUUID(), title: cleanTitle, text: cleanText }];
      }
      if (!sections.some((s) => s.id === id)) throw new UserError("That section was removed.");
      return sections.map((s) => (s.id === id ? { ...s, title: cleanTitle, text: cleanText } : s));
    });
  });
}

export async function deleteRookieParentSection(id: string) {
  return tryAction(async () => {
    await editSections((sections) => sections.filter((s) => s.id !== id));
  });
}

export async function moveRookieParentSection(id: string, direction: "up" | "down") {
  return tryAction(async () => {
    await editSections((sections) => {
      const from = sections.findIndex((s) => s.id === id);
      const to = direction === "up" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= sections.length) return sections;
      const next = [...sections];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  });
}
