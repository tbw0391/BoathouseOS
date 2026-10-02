import { guessGauge, liveWater, nearbyGauges } from "@/lib/waterReadings";
import { GaugePicker } from "./RaceDayControls";

// Water at a regatta's course, from the day before it starts, refreshed every
// 30 minutes (gauges report every 15-60): a USGS gauge near the course (flow,
// level, water temperature) and the nearest weather station to it (air and
// wind). Coaches and admins pick which gauge (0110); until then the app
// guesses the biggest river nearby. Just readings; the club's go/no-go
// limits are for its home water.
export async function RegattaWater({
  eventId,
  lat,
  lng,
  chosenSite,
  canPick,
}: {
  eventId: string;
  lat: number;
  lng: number;
  chosenSite: string | null;
  canPick: boolean;
}) {
  const gauges = await nearbyGauges(lat, lng);
  if (gauges === null && !chosenSite) {
    return (
      <Card>
        <p className="text-gray-500">Couldn&apos;t reach the USGS river gauges just now. Try again in a few minutes.</p>
      </Card>
    );
  }
  const list = gauges ?? [];
  const site = chosenSite ?? guessGauge(list)?.site ?? null;
  if (!site) {
    return (
      <Card>
        <p className="text-gray-500">No river gauge near this course (lakes often don&apos;t have one).</p>
      </Card>
    );
  }

  const { readings: r, gauge: info, airReadAt, station, errors } = await liveWater(site, 30 * 60, { lat, lon: lng });
  const listed = list.find((g) => g.site === site);
  const miles = listed ? listed.km / 1.609344 : null;
  const time = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
      : null;
  const items: [string, string | null][] = [
    ["Flow", r.flowCfs != null ? `${Math.round(r.flowCfs).toLocaleString()} cfs` : null],
    ["Level", r.heightFt != null ? `${r.heightFt.toFixed(2)} ft` : null],
    ["Water", r.waterTempF != null ? `${Math.round(r.waterTempF)}°F` : null],
    ["Air", r.airTempF != null ? `${Math.round(r.airTempF)}°F` : null],
    [
      "Wind",
      r.windMph != null ? `${Math.round(r.windMph)} mph${r.gustMph != null ? `, gusts ${Math.round(r.gustMph)}` : ""}` : null,
    ],
  ];

  return (
    <Card highlight>
      <div className="grid grid-cols-3 gap-2 my-2">
        {items
          .filter(([, v]) => v)
          .map(([label, v]) => (
            <div key={label} className="rounded bg-gray-50 px-2 py-1.5">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-semibold">{v}</p>
            </div>
          ))}
      </div>
      <p className="text-xs text-gray-500">
        USGS gauge: {info?.name ?? listed?.name ?? site}
        {miles != null && `, ${miles < 1 ? "under a mile" : `${miles.toFixed(1)} miles`} from the course`}
        {!chosenSite && " (picked automatically)"}
        {info?.readAt && ` · read ${time(info.readAt)}`}
        {airReadAt && ` · weather ${station ? `from ${station} ` : ""}${time(airReadAt)}`} · updates every 30 minutes
      </p>
      {errors.length > 0 && <p className="text-xs text-amber-700">{errors.join(" ")}</p>}
      {canPick && list.length > 0 && (
        <GaugePicker
          eventId={eventId}
          current={chosenSite}
          options={list.map((g) => ({
            site: g.site,
            label: `${g.name} · ${(g.km / 1.609344).toFixed(1)} mi${g.flowCfs != null ? ` · ${Math.round(g.flowCfs).toLocaleString()} cfs` : ""}`,
          }))}
        />
      )}
    </Card>
  );
}

function Card({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <section
      className={`mb-4 rounded-lg border-2 p-3 text-sm ${highlight ? "border-[var(--color-primary)]" : "border-gray-200"}`}
    >
      <h3 className="font-semibold">Water at the course</h3>
      {children}
    </section>
  );
}
