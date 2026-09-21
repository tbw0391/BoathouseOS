import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NAV_SECTIONS } from "@/lib/navSections";
import { updateNavToggles } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: callerData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((callerData as { role: string } | null)?.role !== "admin") notFound();

  const { data: settingRow } = await supabase
    .from("club_settings")
    .select("value")
    .eq("key", "nav_disabled_hrefs")
    .maybeSingle();
  let disabledHrefs: string[] = [];
  try {
    disabledHrefs = JSON.parse((settingRow as { value: string | null } | null)?.value ?? "[]");
  } catch {
    disabledHrefs = [];
  }
  const disabledSet = new Set(disabledHrefs);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Turn off a button to hide it from everyone&apos;s home screen — handy for features you&apos;re
        still setting up.
      </p>

      <form action={updateNavToggles} className="flex flex-col gap-3 max-w-sm">
        {NAV_SECTIONS.map((s) => (
          <label
            key={s.href}
            className="flex items-center justify-between gap-3 border rounded-lg px-4 py-3 text-sm"
          >
            {s.label}
            <input
              type="checkbox"
              name="enabled_href"
              value={s.href}
              defaultChecked={!disabledSet.has(s.href)}
              className="w-5 h-5"
            />
          </label>
        ))}
        <button
          type="submit"
          className="mt-2 bg-[#022e5d] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#01213f] transition-colors"
        >
          Save
        </button>
      </form>
    </div>
  );
}
