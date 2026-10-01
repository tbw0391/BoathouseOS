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
import { PAPERWORK, PAPERWORK_ROLES, PAPERWORK_SETTINGS_KEY, parsePaperworkSettings } from "@/lib/paperwork";
import { OAR_COLORS_KEY, parseOarSettings } from "@/lib/oarSheet";
import {
  updateAlertSettings,
  updatePaperworkSettings,
  updateNavAccess,
  updateOarSettings,
  updateProfileButtons,
  updateLineupSectionVisibility,
  updateThemeColors,
  resetThemeColors,
  updateAppIcon,
  removeAppIcon,
} from "./actions";
import { updateStoreLink } from "@/app/store/actions";
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
      "team_store_url",
      PAPERWORK_SETTINGS_KEY,
    ]);
  const settingsByKey = new Map(
    ((settingsData as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const themeColors = parseThemeColors(settingsByKey.get("theme_colors"));
  const lineupSectionVisibility = resolveLineupSectionVisibility(settingsByKey);
  const alertsEnabled = parseAlertSettings(settingsByKey.get(ALERT_SETTINGS_KEY));
  const oarSettings = parseOarSettings(settingsByKey.get(OAR_COLORS_KEY));
  const storeUrl = settingsByKey.get("team_store_url") ?? null;
  const paperworkSettings = parsePaperworkSettings(settingsByKey.get(PAPERWORK_SETTINGS_KEY));
  const { data: clubRow } = await supabase
    .from("clubs")
    .select("name, app_name, app_short_name, icon_path, icon_updated_at")
    .maybeSingle();
  const club = clubRow as {
    name: string;
    app_name: string | null;
    app_short_name: string | null;
    icon_path: string | null;
    icon_updated_at: string | null;
  } | null;

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Settings</h1>

      <h2 className="text-lg font-semibold mt-6 mb-2">App name and icon</h2>
      <p className="text-sm text-gray-500 mb-4">
        What members see on their phone&apos;s home screen when they add the app. Use a square
        logo (PNG or JPG). Members who already added the app may need to remove it and add it
        again to see a new icon.
      </p>
      <ActionForm action={updateAppIcon} altAction={removeAppIcon} className="flex flex-col gap-3 max-w-sm mb-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/club-icon/192?v=${club?.icon_updated_at ? Date.parse(club.icon_updated_at) : "default"}`}
            alt="Current app icon"
            width={64}
            height={64}
            className="rounded-xl border"
          />
          <input type="file" name="icon" accept="image/png,image/jpeg,image/webp" className="text-sm" />
        </div>
        <label className="text-sm flex flex-col gap-1">
          App name
          <input
            name="app_name"
            defaultValue={club?.app_name ?? ""}
            placeholder={club?.name ?? "BoathouseOS"}
            maxLength={40}
            className="border rounded px-3 py-2"
          />
        </label>
        <label className="text-sm flex flex-col gap-1">
          Name under the icon (12 letters at most)
          <input
            name="app_short_name"
            defaultValue={club?.app_short_name ?? ""}
            placeholder="e.g. W-Crew"
            maxLength={12}
            className="border rounded px-3 py-2"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
          >
            Save name and icon
          </button>
          {club?.icon_path && (
            <button type="submit" data-action="alt" className="text-sm text-gray-500 hover:underline px-2">
              Use the BoathouseOS icon
            </button>
          )}
        </div>
      </ActionForm>

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

      <h2 className="text-lg font-semibold mt-8 mb-2">Team store</h2>
      <p className="text-sm text-gray-500 mb-4">
        Paste the link to the club&apos;s online store. A Team Store button shows on the home
        screen while a link is saved; leave it blank to hide it.
      </p>
      <ActionForm action={updateStoreLink} className="flex flex-col gap-3 max-w-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Store link</span>
          <input
            name="url"
            type="url"
            defaultValue={storeUrl ?? ""}
            className="border rounded-lg px-3 py-2"
            placeholder="https://..."
          />
        </label>
        <a href="/store?edit=1" className="text-xs text-gray-500 hover:underline">
          Pick featured items for the home screen →
        </a>
        <button
          type="submit"
          className="mt-2 bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
        >
          Save
        </button>
      </ActionForm>

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

      <h2 className="text-lg font-semibold mt-8 mb-2">Paperwork</h2>
      <p className="text-sm text-gray-500 mb-6">
        Who needs each item (shown on their profile and on Coach &gt; Paperwork), and whether parents can see
        their child&apos;s paperwork.
      </p>

      <ActionForm action={updatePaperworkSettings} className="flex flex-col gap-3 max-w-sm">
        {PAPERWORK.map((p) => (
          <div key={p.kind} className="border rounded-lg px-4 py-3 text-sm flex flex-col gap-2">
            <span className="font-medium">{p.label}</span>
            <div className="flex flex-col gap-1">
              {PAPERWORK_ROLES.map(({ role, label }) => (
                <label key={role} className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    name={`paperwork:${p.kind}`}
                    value={role}
                    defaultChecked={paperworkSettings.required[p.kind].includes(role)}
                    className="w-4 h-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <label className="border rounded-lg px-4 py-3 text-sm flex items-start gap-2">
          <input
            type="checkbox"
            name="parents_see_child"
            defaultChecked={paperworkSettings.parentsSeeChild}
            className="w-4 h-4 mt-0.5"
          />
          <span>
            <span className="font-medium">Parents see their child&apos;s paperwork</span>
            <span className="block text-xs text-gray-500">What&apos;s done, running out or missing, on their child&apos;s profile.</span>
          </span>
        </label>
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
