import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NAV_SECTIONS, NAV_VISIBILITY_OPTIONS, resolveNavVisibility } from "@/lib/navSections";
import { LINEUP_SECTIONS, resolveLineupSectionVisibility } from "@/lib/lineupSections";
import { THEME_COLOR_LABELS, parseThemeColors, type ThemeColorKey } from "@/lib/theme";
import {
  updateNavToggles,
  updateLineupSectionVisibility,
  updateThemeColors,
  resetThemeColors,
  saveDemoBaseline,
  resetDemo,
} from "./actions";

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

  const { data: isGlobalAdmin } = await supabase.rpc("is_global_admin");
  const { data: baselineSavedAt } = isGlobalAdmin
    ? await supabase.rpc("demo_baseline_saved_at")
    : { data: null };
  const { data: interestData } = isGlobalAdmin
    ? await supabase
        .from("interest_signups")
        .select("id, name, club_name, email, phone, created_at")
        .order("created_at", { ascending: false })
    : { data: null };
  const interestSignups =
    (interestData as
      | { id: string; name: string | null; club_name: string | null; email: string | null; phone: string | null; created_at: string }[]
      | null) ?? [];

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Settings</h1>

      {isGlobalAdmin && (
        <div className="border-2 border-red-300 rounded-lg p-4 mt-4 mb-8 max-w-sm">
          <h2 className="text-lg font-semibold mb-1">Demo controls</h2>
          <p className="text-sm text-gray-500 mb-4">
            Only you can see this. Reset puts every setting, member, schedule, lineup and message
            back to the saved baseline, and deletes accounts created since.
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Baseline:{" "}
            {baselineSavedAt
              ? new Date(baselineSavedAt as string).toLocaleString()
              : "not saved yet"}
          </p>
          <form action={resetDemo} className="flex flex-col gap-2 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" required />
              I want to undo everyone&apos;s changes
            </label>
            <button
              type="submit"
              disabled={!baselineSavedAt}
              className="bg-red-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Reset demo
            </button>
          </form>
          <form action={saveDemoBaseline}>
            <button type="submit" className="text-sm text-gray-600 hover:underline">
              Save current data as the new baseline
            </button>
          </form>

          <h3 className="text-sm font-semibold mt-6 mb-2">
            Interested clubs ({interestSignups.length})
          </h3>
          {interestSignups.length === 0 ? (
            <p className="text-xs text-gray-500">No one yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {interestSignups.map((s) => (
                <li key={s.id} className="border rounded px-3 py-2 text-sm">
                  <p className="font-medium">
                    {s.name ?? "No name"}
                    {s.club_name && <span className="text-gray-500 font-normal"> · {s.club_name}</span>}
                  </p>
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="block text-[var(--color-primary)] hover:underline">
                      {s.email}
                    </a>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="block text-[var(--color-primary)] hover:underline">
                      {s.phone}
                    </a>
                  )}
                  <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
