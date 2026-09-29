import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  NAV_ACCESS_KEY,
  NAV_ROLES,
  NAV_VISIBILITY_OPTIONS,
  navSectionsFor,
  resolveNavAccess,
} from "@/lib/navSections";
import {
  PROFILE_BUTTONS_KEY,
  PROFILE_GROUPS,
  profileButtonsFor,
  resolveProfileButtons,
} from "@/lib/profileButtons";
import { RoleButtonsForm } from "./RoleButtonsForm";
import { LINEUP_SECTIONS, resolveLineupSectionVisibility } from "@/lib/lineupSections";
import { THEME_COLOR_LABELS, parseThemeColors, type ThemeColorKey } from "@/lib/theme";
import { ALERT_SETTINGS_KEY, ALERT_TYPES, parseAlertSettings } from "@/lib/alertSettings";
import { OAR_COLORS_KEY, parseOarSettings } from "@/lib/oarSheet";
import {
  updateAlertSettings,
  updateNavAccess,
  updateOarSettings,
  updateProfileButtons,
  updateLineupSectionVisibility,
  updateThemeColors,
  resetThemeColors,
} from "./actions";
import { ActionForm } from "@/components/ActionForm";

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
    .in("key", [
      "nav_visibility",
      "nav_disabled_hrefs",
      NAV_ACCESS_KEY,
      PROFILE_BUTTONS_KEY,
      "theme_colors",
      "lineup_section_visibility",
      ALERT_SETTINGS_KEY,
      OAR_COLORS_KEY,
    ]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const themeColors = parseThemeColors(settingsByKey.get("theme_colors"));
  const lineupSectionVisibility = resolveLineupSectionVisibility(settingsByKey);
  const alertsEnabled = parseAlertSettings(settingsByKey.get(ALERT_SETTINGS_KEY));
  const oarSettings = parseOarSettings(settingsByKey.get(OAR_COLORS_KEY));

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Settings</h1>

      <h2 className="text-lg font-semibold mt-6 mb-2">Site colors</h2>
      <p className="text-sm text-gray-500 mb-4">
        Pick the 4 colors used across the site&apos;s buttons, borders, and background.
      </p>
      <ActionForm action={updateThemeColors} altAction={resetThemeColors} className="flex flex-col gap-3 max-w-sm mb-8">
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
            data-action="alt"
            className="text-sm text-gray-500 hover:underline px-2"
          >
            Reset to defaults
          </button>
        </div>
      </ActionForm>

      <h2 className="text-lg font-semibold mb-2">Home screen buttons</h2>
      <p className="text-sm text-gray-500 mb-4">
        Pick a type of user, then choose which buttons they see on the home screen.
      </p>
      <RoleButtonsForm
        groups={NAV_ROLES.map(({ role, label }) => ({ key: role, label }))}
        buttonsByGroup={Object.fromEntries(NAV_ROLES.map(({ role }) => [role, navSectionsFor(role)]))}
        initialAccess={resolveNavAccess(settingsByKey)}
        onSave={updateNavAccess}
        savedMessage="Saved. Everyone sees the change next time they open the home screen."
      />

      <h2 className="text-lg font-semibold mt-8 mb-2">Profile buttons</h2>
      <p className="text-sm text-gray-500 mb-4">
        Pick a group, then choose which shortcut buttons they see on their own profile. Board
        members get their usual group&apos;s buttons plus the Board Member ones.
      </p>
      <RoleButtonsForm
        groups={PROFILE_GROUPS.map(({ group, label }) => ({ key: group, label }))}
        buttonsByGroup={Object.fromEntries(PROFILE_GROUPS.map(({ group }) => [group, profileButtonsFor(group)]))}
        initialAccess={resolveProfileButtons(settingsByKey)}
        onSave={updateProfileButtons}
        savedMessage="Saved. Everyone sees the change next time they open their profile."
      />

      <h2 className="text-lg font-semibold mt-8 mb-2">Alerts</h2>
      <p className="text-sm text-gray-500 mb-6">
        Turn each kind of alert on or off for the whole club. Phone alerts only reach people who
        turned on alerts on their phone.
      </p>

      <ActionForm action={updateAlertSettings} className="flex flex-col gap-3 max-w-sm">
        {ALERT_TYPES.map((t) => (
          <div key={t.kind} className="border rounded-lg px-4 py-3 text-sm flex flex-col gap-2">
            <span className="font-medium">{t.label}</span>
            <span className="text-xs text-gray-500">{t.detail}</span>
            <div className="flex gap-4">
              {(["on", "off"] as const).map((option) => (
                <label key={option} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="radio"
                    name={`alert:${t.kind}`}
                    value={option}
                    defaultChecked={alertsEnabled[t.kind] === (option === "on")}
                    className="w-4 h-4"
                  />
                  {option === "on" ? "On" : "Off"}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="submit"
          className="mt-2 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
        >
          Save
        </button>
      </ActionForm>

      <h2 className="text-lg font-semibold mt-8 mb-2">Oar tape</h2>
      <p className="text-sm text-gray-500 mb-4">
        Oars are named by their tape color and number of rings (&quot;3 Green&quot;). Coxes pick
        from these on each boat&apos;s oar sheet.
      </p>
      <ActionForm action={updateOarSettings} className="flex flex-col gap-3 max-w-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tape colors</span>
          <input
            name="colors"
            defaultValue={oarSettings.colors.join(", ")}
            className="border rounded-lg px-3 py-2"
            placeholder="Blue, Green, Red"
          />
          <span className="text-xs text-gray-500">Separate with commas.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Most rings on an oar</span>
          <input
            name="max_rings"
            type="number"
            min={1}
            max={20}
            defaultValue={oarSettings.maxRings}
            className="border rounded-lg px-3 py-2 w-24"
          />
        </label>
        <button
          type="submit"
          className="mt-2 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
        >
          Save
        </button>
      </ActionForm>

      <h2 className="text-lg font-semibold mt-8 mb-2">Lineups sections</h2>
      <p className="text-sm text-gray-500 mb-6">
        Control who sees each section of the Lineups page: everyone, coaches only, admins only,
        or off for everyone.
      </p>

      <ActionForm action={updateLineupSectionVisibility} className="flex flex-col gap-3 max-w-sm">
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
      </ActionForm>
    </div>
  );
}
