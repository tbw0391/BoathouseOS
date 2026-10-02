import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { liveWater, type LiveWater } from "@/lib/waterReadings";
import {
  PRACTICE_CALL_LABELS,
  LIGHTNING_WAIT_MINUTES,
  WATER_SETTINGS_KEY,
  callConditionsLine,
  evaluateWater,
  lightningMinutesLeft,
  parseWaterSettings,
} from "@/lib/waterConditions";
import { CLUB_TIME_ZONE, clubDateKey, clubTimeLabel } from "@/lib/raceDay";
import { LightningControls, PracticeCallForm, WaterSettingsForm } from "./WaterControls";

export const dynamic = "force-dynamic";

const VERDICT_STYLE = {
  go: { label: "Go", className: "bg-green-600" },
  caution: { label: "Caution", className: "bg-amber-500" },
  "no-go": { label: "No-go", className: "bg-red-700" },
  unknown: { label: "No readings", className: "bg-gray-500" },
} as const;

const CALL_STYLE: Record<string, string> = {
  go: "border-green-600 bg-green-50",
  caution: "border-amber-500 bg-amber-50",
  land: "border-blue-600 bg-blue-50",
  cancelled: "border-red-700 bg-red-50",
};

function ageLabel(iso: string | null) {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 60 ? `${min} min ago` : clubTimeLabel(iso);
}

export default async function WaterPage({ searchParams }: { searchParams: Promise<{ call?: string }> }) {
  const { call: openCall } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = clubDateKey(new Date());
  const [{ data: me }, { data: settingRow }, { data: callRow }, { data: holdRows }, { data: regattaRows }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("club_settings").select("value").eq("key", WATER_SETTINGS_KEY).maybeSingle(),
    supabase.from("practice_calls").select("*").eq("practice_date", clubDateKey(new Date())).maybeSingle(),
    supabase.from("lightning_holds").select("*").is("cleared_at", null).order("started_at", { ascending: false }).limit(1),
    // Regattas around today, to read the weather at the course on race day.
    supabase
      .from("schedule_events")
      .select("title, starts_at, ends_at, start_lat, start_lng, finish_lat, finish_lng")
      .eq("event_type", "regatta")
      .gte("starts_at", new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())
      .lte("starts_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
  ]);
  const role = (me as { role: string } | null)?.role;
  const isManager = role === "coach" || role === "admin";
  const settings = parseWaterSettings((settingRow as { value: string | null } | null)?.value);
  const call = callRow as {
    status: string;
    note: string | null;
    water_temp_f: number | null;
    air_temp_f: number | null;
    wind_mph: number | null;
    wind_dir: string | null;
    called_at: string;
  } | null;
  const hold =
    ((holdRows as { id: string; last_strike_at: string; started_at: string; started_by: string | null }[] | null) ??
      [])[0] ?? null;

  // Where the weather is read: a regatta's course on race day, else the
  // club's weather location (e.g. its lake), else the river gauge.
  const regattaToday = (
    (regattaRows as {
      title: string;
      starts_at: string;
      ends_at: string | null;
      start_lat: number | null;
      start_lng: number | null;
      finish_lat: number | null;
      finish_lng: number | null;
    }[] | null) ?? []
  ).find((r) => clubDateKey(r.starts_at) <= today && today <= clubDateKey(r.ends_at ?? r.starts_at));
  const coursePoint =
    regattaToday?.finish_lat != null && regattaToday.finish_lng != null
      ? { lat: regattaToday.finish_lat, lon: regattaToday.finish_lng }
      : regattaToday?.start_lat != null && regattaToday.start_lng != null
        ? { lat: regattaToday.start_lat, lon: regattaToday.start_lng }
        : null;
  const homePoint =
    settings.weatherLat != null && settings.weatherLon != null ? { lat: settings.weatherLat, lon: settings.weatherLon } : null;
  const weatherAt = coursePoint ?? homePoint;
  const weatherPlace = coursePoint ? regattaToday!.title : homePoint ? settings.weatherName : null;
  const live: LiveWater | null =
    settings.gaugeSite || weatherAt ? await liveWater(settings.gaugeSite, undefined, weatherAt) : null;
  const readings = live?.readings ?? null;
  // A coach's measured water temperature beats a gauge without a sensor.
  if (readings && readings.waterTempF == null && call?.water_temp_f != null) readings.waterTempF = Number(call.water_temp_f);
  const result = readings ? evaluateWater(readings, settings) : null;
  const style = VERDICT_STYLE[result?.verdict ?? "unknown"];
  const holdLeft = hold ? lightningMinutesLeft(hold.last_strike_at) : 0;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold mt-4">Water Conditions</h1>
      </div>

      {hold && (
        <div className="rounded-lg bg-red-700 text-white p-4">
          <p className="text-lg font-bold">⚡ Lightning hold</p>
          <p className="text-sm">
            {holdLeft > 0
              ? `Stay off the water. ${holdLeft} minute${holdLeft === 1 ? "" : "s"} left if there's no more thunder.`
              : "30 minutes have passed since the last thunder. Waiting on a coach's all clear."}
          </p>
          <p className="text-xs opacity-80 mt-1">Last thunder or lightning at {clubTimeLabel(hold.last_strike_at)}</p>
          {!hold.started_by && (
            <p className="text-xs opacity-80">
              Started automatically: NOAA&apos;s weather satellite saw lightning within {settings.lightningMiles} miles.
              It clears itself after {LIGHTNING_WAIT_MINUTES} minutes with no more.
            </p>
          )}
        </div>
      )}
      {isManager && <LightningControls active={!!hold} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Today&apos;s call</h2>
        {call ? (
          <div className={`rounded-lg border-2 p-3 ${CALL_STYLE[call.status] ?? ""}`}>
            <p className="font-semibold">{PRACTICE_CALL_LABELS[call.status]}</p>
            {callConditionsLine(call) && <p className="text-sm mt-1">{callConditionsLine(call)}</p>}
            {call.note && <p className="text-sm mt-1 whitespace-pre-line">{call.note}</p>}
            <p className="text-xs text-gray-500 mt-1">Called at {clubTimeLabel(call.called_at)}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No call from the coaches yet today.</p>
        )}
        {isManager && (
          <PracticeCallForm
            current={call?.status ?? null}
            currentNote={call?.note ?? ""}
            startOpen={openCall === "1"}
            defaults={{
              waterTempF: call?.water_temp_f != null ? Number(call.water_temp_f) : (live?.readings.waterTempF ?? null),
              airTempF: call?.air_temp_f != null ? Number(call.air_temp_f) : (live?.readings.airTempF ?? null),
              windMph: call?.wind_mph != null ? Number(call.wind_mph) : (live?.readings.windMph ?? null),
              windDir: call?.wind_dir ?? live?.readings.windDir ?? null,
            }}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Conditions now</h2>
        {regattaToday && !coursePoint && (
          <p className="text-sm text-amber-700">
            {regattaToday.title} is today, but its course isn&apos;t set, so this is the weather at home. Add the
            course&apos;s start or finish on the regatta&apos;s Course tab.
          </p>
        )}
        {!live ? (
          <p className="text-sm text-gray-600">
            {role === "admin"
              ? "Set the club's river gauge or weather location below to see live conditions."
              : "An admin hasn't set up the river gauge or weather location yet."}
          </p>
        ) : (
          <>
            <div className={`rounded-lg text-white p-4 ${style.className}`}>
              <p className="text-2xl font-bold">{style.label}</p>
              {result && result.reasons.length > 0 ? (
                <ul className="text-sm mt-1 list-disc pl-5">
                  {result.reasons.map((r) => (
                    <li key={r.text}>
                      {r.text}
                      {r.level === "no-go" ? " (over the club's limit)" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                result?.verdict === "go" && <p className="text-sm mt-1">Everything is inside the club&apos;s limits.</p>
              )}
            </div>
            {live && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Reading label="River flow" value={readings?.flowCfs != null ? `${Math.round(readings.flowCfs).toLocaleString()} cfs` : null} />
                <Reading label="River level" value={readings?.heightFt != null ? `${readings.heightFt.toFixed(2)} ft` : null} />
                <Reading label="Water temp" value={readings?.waterTempF != null ? `${Math.round(readings.waterTempF)}°F` : null} />
                <Reading label="Air temp" value={readings?.airTempF != null ? `${Math.round(readings.airTempF)}°F` : null} />
                <Reading
                  label="Wind"
                  value={
                    readings?.windMph != null
                      ? `${Math.round(readings.windMph)} mph${readings.windDir ? ` from ${readings.windDir}` : ""}${
                          readings.gustMph != null ? `, gusts ${Math.round(readings.gustMph)}` : ""
                        }`
                      : null
                  }
                />
                <Reading
                  label="Air + water"
                  value={
                    readings?.airTempF != null && readings.waterTempF != null
                      ? `${Math.round(readings.airTempF + readings.waterTempF)}°F`
                      : null
                  }
                />
              </dl>
            )}
            {live && (
              <p className="text-xs text-gray-500">
                {live.gauge && `USGS gauge: ${live.gauge.name}${live.gauge.readAt ? `, ${ageLabel(live.gauge.readAt)}` : ""}. `}
                Weather{weatherPlace ? ` for ${weatherPlace}` : ""}: National Weather Service
                {live.station && ` (${live.station}, the nearest station)`}
                {live.airReadAt && `, ${ageLabel(live.airReadAt)}`}. Readings are a guide; the coaches make the call.
              </p>
            )}
            {live?.errors.map((e) => (
              <p key={e} className="text-sm text-amber-700">
                {e}
              </p>
            ))}
          </>
        )}
      </section>

      {role === "admin" && <WaterSettingsForm settings={settings} />}

      <p className="text-xs text-gray-400">
        Times are {CLUB_TIME_ZONE.replace("_", " ")}.
      </p>
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border-2 border-gray-200 px-3 py-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-semibold">{value ?? "—"}</dd>
    </div>
  );
}
