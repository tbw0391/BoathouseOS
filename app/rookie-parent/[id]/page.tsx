import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LEGACY_ROOKIE_PARENT_KEYS,
  ROOKIE_PARENT_SECTIONS_KEY,
  parseRookieParentSections,
} from "@/lib/rookieParent";
import { SectionEditor } from "../SectionEditor";

export default async function RookieParentSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: callerProfile }, { data: settingsData }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").single(),
    supabase
      .from("club_settings")
      .select("key, value")
      .in("key", [ROOKIE_PARENT_SECTIONS_KEY, ...LEGACY_ROOKIE_PARENT_KEYS]),
  ]);
  const isAdmin = (callerProfile as { role: string } | null)?.role === "admin";
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [
      s.key,
      s.value,
    ])
  );
  const section = parseRookieParentSections(settingsByKey.get(ROOKIE_PARENT_SECTIONS_KEY), settingsByKey).find(
    (s) => s.id === id,
  );
  if (!section) notFound();

  return (
    <div className="min-h-screen p-8 max-w-lg flex flex-col gap-4">
      <Link href="/rookie-parent" className="text-sm text-gray-500 hover:underline">
        ← Rookie Parent
      </Link>
      <SectionEditor section={section} canEdit={isAdmin} />
    </div>
  );
}
