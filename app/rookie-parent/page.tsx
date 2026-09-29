import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  LEGACY_ROOKIE_PARENT_KEYS,
  ROOKIE_PARENT_SECTIONS_KEY,
  parseRookieParentSections,
} from "@/lib/rookieParent";
import { AddSection, MoveUpButton } from "./SectionEditor";

export default async function RookieParentPage() {
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
  const sections = parseRookieParentSections(settingsByKey.get(ROOKIE_PARENT_SECTIONS_KEY), settingsByKey);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Rookie Parent</h1>
      <p className="text-sm text-gray-500 mb-6">New to the team? Start here.</p>

      <div className="flex flex-col gap-3 max-w-md">
        {sections.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <Link
              href={`/rookie-parent/${s.id}`}
              className="flex-1 rounded-lg border-2 border-[var(--color-primary)] px-4 py-3 text-center font-medium hover:bg-[var(--color-secondary)] hover:text-white transition-colors"
            >
              {s.title}
            </Link>
            {isAdmin && <MoveUpButton id={s.id} isFirst={i === 0} />}
          </div>
        ))}
        {sections.length === 0 && <p className="text-sm text-gray-500">Nothing here yet.</p>}
        {isAdmin && (
          <div className="mt-4 flex flex-col gap-2">
            <AddSection />
            <p className="text-xs text-gray-500">Open a section to edit or delete it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
