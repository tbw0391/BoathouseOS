import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NAV_SECTIONS, NAV_VISIBILITY_OPTIONS, resolveNavVisibility } from "@/lib/navSections";
import { updateNavToggles } from "./actions";

const VISIBILITY_LABEL: Record<string, string> = {
  everyone: "Everyone",
  admins: "Admins only",
  off: "Off",
};

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

  const { data: settingsData } = await supabase
    .from("club_settings")
    .select("key, value")
    .in("key", ["nav_visibility", "nav_disabled_hrefs"]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const visibilityByHref = resolveNavVisibility(settingsByKey);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Control who sees each button on the home screen: everyone, admins only, or off for
        everyone — handy for features you&apos;re still setting up.
      </p>

      <form action={updateNavToggles} className="flex flex-col gap-3 max-w-sm">
        {NAV_SECTIONS.map((s) => {
          const current = visibilityByHref[s.href] ?? "everyone";
          return (
            <div key={s.href} className="border rounded-lg px-4 py-3 text-sm flex flex-col gap-2">
              <span className="font-medium">{s.label}</span>
              <div className="flex gap-4">
                {NAV_VISIBILITY_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="radio"
                      name={`visibility:${s.href}`}
                      value={option}
                      defaultChecked={current === option}
                      className="w-4 h-4"
                    />
                    {VISIBILITY_LABEL[option]}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
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
