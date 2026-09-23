import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NAV_SECTIONS, NAV_VISIBILITY_OPTIONS, resolveNavVisibility } from "@/lib/navSections";
import { LINEUP_SECTIONS, resolveLineupSectionVisibility } from "@/lib/lineupSections";
import { THEME_COLOR_LABELS, parseThemeColors, type ThemeColorKey } from "@/lib/theme";
import { updateNavToggles, updateLineupSectionVisibility, updateThemeColors, resetThemeColors } from "./actions";

const VISIBILITY_LABEL: Record<string, string> = {
  everyone: "Everyone",
  coaches: "Coaches only",
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
    .in("key", ["nav_visibility", "nav_disabled_hrefs", "theme_colors", "lineup_section_visibility"]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const visibilityByHref = resolveNavVisibility(settingsByKey);
  const themeColors = parseThemeColors(settingsByKey.get("theme_colors"));
  const lineupSectionVisibility = resolveLineupSectionVisibility(settingsByKey);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Settings</h1>

      <h2 className="text-lg font-semibold mt-6 mb-2">Site colors</h2>
      <p className="text-sm text-gray-500 mb-4">
        Pick the 4 colors used across the site&apos;s buttons, borders, and background.
      </p>
      <form action={updateThemeColors} className="flex flex-col gap-3 max-w-sm mb-8">
        {(Object.keys(THEME_COLOR_LABELS) as ThemeColorKey[]).map((key) => (
          <div key={key} className="border rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-3">
            <span className="font-medium">{THEME_COLOR_LABELS[key]}</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                name={`color:${key}`}
                defaultValue={themeColors[key]}
                className="w-10 h-8 rounded border p-0 cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-mono">{themeColors[key]}</span>
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            className="flex-1 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
          >
            Save colors
          </button>
          <button
            type="submit"
            formAction={resetThemeColors}
            className="text-sm text-gray-500 hover:underline px-2"
          >
            Reset to defaults
          </button>
        </div>
      </form>

      <h2 className="text-lg font-semibold mb-2">Home screen buttons</h2>
      <p className="text-sm text-gray-500 mb-6">
        Control who sees each button on the home screen: everyone, coaches only, admins only, or
        off for everyone — handy for features you&apos;re still setting up.
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
          className="mt-2 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
        >
          Save
        </button>
      </form>

      <h2 className="text-lg font-semibold mt-8 mb-2">Lineups sections</h2>
      <p className="text-sm text-gray-500 mb-6">
        Control who sees each section of the Lineups page: everyone, coaches only, admins only,
        or off for everyone.
      </p>

      <form action={updateLineupSectionVisibility} className="flex flex-col gap-3 max-w-sm">
        {LINEUP_SECTIONS.map((s) => {
          const current = lineupSectionVisibility[s.id] ?? "everyone";
          return (
            <div key={s.id} className="border rounded-lg px-4 py-3 text-sm flex flex-col gap-2">
              <span className="font-medium">{s.label}</span>
              <div className="flex gap-4">
                {NAV_VISIBILITY_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="radio"
                      name={`visibility:${s.id}`}
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
          className="mt-2 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
        >
          Save
        </button>
      </form>
    </div>
  );
}
