import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { startBoatSim, stopBoatSim } from "./actions";
import { Card, buttonClass, outlineButtonClass } from "./ui";

type Club = { id: string; name: string; slug: string };

function TapChoices({ name, options, initial }: { name: string; options: { value: string; label: string }[]; initial: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm has-[:checked]:bg-[var(--color-primary)] has-[:checked]:text-white has-[:checked]:border-[var(--color-primary)]"
        >
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === initial} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

// Demo: pretend boats rowing on Hoover Reservoir, so live tracking has
// something to show (0123). They move on their own (a database job) until
// their time is up or someone taps Stop.
export async function BoatSimCard({ clubs }: { clubs: Club[] }) {
  const supabase = await createClient();
  const statuses = await Promise.all(
    clubs.map(async (club) => {
      const { data } = await supabase.rpc("on_water_sim_status", { p_club_id: club.id });
      const row = (data as { boats: number; ends_at: string | null }[] | null)?.[0];
      return { club, boats: row?.boats ?? 0, endsAt: row?.ends_at ?? null };
    })
  );
  const running = statuses.filter((s) => s.boats > 0);
  const defaultClub = clubs.find((c) => c.slug === "demo") ?? clubs[0];
  if (!defaultClub) return null;

  return (
    <Card title="Demo: boats on the water">
      <p className="text-sm text-gray-500">
        Puts pretend boats on Hoover Reservoir, one for each free coxswain, rowing up and down with live GPS. See them
        on Live Tracking and On the Water.
      </p>

      {running.map((s) => (
        <ActionForm key={s.club.id} action={stopBoatSim} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <input type="hidden" name="clubId" value={s.club.id} />
          <span className="text-sm">
            {s.boats} {s.boats === 1 ? "boat" : "boats"} out{clubs.length > 1 ? ` (${s.club.name})` : ""} until{" "}
            {s.endsAt
              ? new Date(s.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
              : "—"}
          </span>
          <button type="submit" className={outlineButtonClass}>
            Stop
          </button>
        </ActionForm>
      ))}

      <ActionForm action={startBoatSim} className="flex flex-col gap-3">
        {clubs.length > 1 ? (
          <TapChoices name="clubId" options={clubs.map((c) => ({ value: c.id, label: c.name }))} initial={defaultClub.id} />
        ) : (
          <input type="hidden" name="clubId" value={defaultClub.id} />
        )}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Boats</span>
          <TapChoices name="boats" options={["2", "3", "5", "8"].map((v) => ({ value: v, label: v }))} initial="5" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">For</span>
          <TapChoices
            name="minutes"
            options={[
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "1 hour" },
              { value: "120", label: "2 hours" },
            ]}
            initial="30"
          />
        </div>
        <button type="submit" className={buttonClass}>
          {running.length ? "Start over" : "Put boats on the water"}
        </button>
      </ActionForm>
      <Link href="/coach/tracking" className="text-sm text-[var(--color-primary)] hover:underline">
        Open Live Tracking →
      </Link>
    </Card>
  );
}
