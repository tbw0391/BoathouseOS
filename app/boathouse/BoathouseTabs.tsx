"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { unwrap } from "@/lib/userError";
import {
  BOOKING_LENGTHS,
  RATING_LEVELS,
  isOverdue,
  ratingLabel,
  type BoathouseBoat,
  type Erg,
  type Reservation,
  type SignOut,
} from "@/lib/boathouse";
import {
  addErg,
  bookEquipment,
  cancelReservation,
  removeErg,
  setBoatBooking,
  setRating,
  signInBoat,
  signOutBoat,
  updateErg,
} from "./actions";

export type Person = { id: string; name: string; role: string; rating: number };

const TZ = "America/New_York";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });

const button =
  "rounded-lg bg-[var(--color-primary)] text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50";
const card = "rounded-lg border-2 border-gray-200 p-3 text-sm";

function useRunner() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run(fn: () => Promise<unknown>, after?: () => void) {
    setMessage(null);
    start(async () => {
      try {
        const result = await fn();
        if (result && typeof result === "object" && "ok" in result) unwrap(result as never);
        after?.();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }
  return { message, pending, run };
}

function names(ids: string[], people: Person[]) {
  const byId = new Map(people.map((p) => [p.id, p.name]));
  return ids.map((id) => byId.get(id) ?? "Someone").join(", ");
}

// Pick who's rowing: type to find, tap to add.
function CrewPicker({ people, value, onChange }: { people: Person[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const matches = q.trim()
    ? people.filter((p) => !value.includes(p.id) && p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {value.map((id) => (
          <span key={id} className="rounded-full bg-gray-100 px-2 py-0.5 flex items-center gap-1">
            {names([id], people)}
            <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((v) => v !== id))} className="text-gray-500">
              ✕
            </button>
          </span>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Add someone…"
        className="border rounded px-2 py-1"
      />
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange([...value, p.id]);
                setQ("");
              }}
              className="rounded border px-2 py-0.5 hover:border-[var(--color-primary)]"
            >
              + {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function defaultBackBy() {
  const d = new Date(Date.now() + 90 * 60000);
  const parts = d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).split(":");
  const m = Math.ceil(Number(parts[1]) / 15) * 15;
  const h = (Number(parts[0]) + (m === 60 ? 1 : 0)) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function SignInForm({ signout, onDone }: { signout: SignOut; onDone: () => void }) {
  const { message, pending, run } = useRunner();
  const [km, setKm] = useState("");
  const [damage, setDamage] = useState("");
  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2">
      <label className="flex flex-col">
        Distance (km, optional)
        <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} className="border rounded px-2 py-1 w-28" />
      </label>
      <label className="flex flex-col">
        Anything broken or not working? (goes to Boat Maintenance)
        <textarea value={damage} onChange={(e) => setDamage(e.target.value)} rows={2} className="border rounded px-2 py-1" />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={button}
          onClick={() => run(() => signInBoat(signout.id, km.trim() ? Number(km) : null, damage), onDone)}
        >
          Signed back in
        </button>
        <button type="button" onClick={onDone} className="text-gray-500 underline">
          Cancel
        </button>
      </div>
      {message && <p className="text-red-600">{message}</p>}
    </div>
  );
}

export function LogbookTab({
  meId,
  isStaff,
  boats,
  people,
  out,
  recent,
}: {
  meId: string;
  isStaff: boolean;
  boats: BoathouseBoat[];
  people: Person[];
  out: SignOut[];
  recent: SignOut[];
}) {
  const { message, pending, run } = useRunner();
  const boatName = (id: string) => boats.find((b) => b.id === id)?.name ?? "A boat";
  const outIds = new Set(out.map((s) => s.boat_id));
  const available = boats.filter((b) => !b.out_of_service && !outIds.has(b.id) && (isStaff || b.bookable));
  const [boatId, setBoatId] = useState("");
  const [crew, setCrew] = useState<string[]>(isStaff ? [] : [meId]);
  const [backBy, setBackBy] = useState(defaultBackBy);
  const [route, setRoute] = useState("");
  const [signingIn, setSigningIn] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-lg font-semibold">On the water now</h2>
        {out.length === 0 && <p className="text-sm text-gray-500 mt-1">Nobody&apos;s signed out.</p>}
        <div className="mt-2 flex flex-col gap-2">
          {out.map((s) => {
            const late = isOverdue(s);
            const canSignIn = isStaff || s.rower_ids.includes(meId) || s.signed_out_by === meId;
            return (
              <div key={s.id} className={`${card} ${late ? "border-red-400 bg-red-50" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{boatName(s.boat_id)}</p>
                  <p className={late ? "text-red-700 font-semibold" : "text-gray-600"}>
                    {late ? "Overdue: was due " : "Back by "}
                    {time(s.expected_back_at)}
                  </p>
                </div>
                <p>{names(s.rower_ids, people)}</p>
                <p className="text-gray-500">
                  Out {time(s.out_at)}
                  {s.route ? ` · ${s.route}` : ""}
                </p>
                {canSignIn && signingIn !== s.id && (
                  <button type="button" className={`${button} mt-2`} onClick={() => setSigningIn(s.id)}>
                    Sign in
                  </button>
                )}
                {signingIn === s.id && <SignInForm signout={s} onDone={() => setSigningIn(null)} />}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Take a boat out</h2>
        {available.length === 0 ? (
          <p className="text-sm text-gray-500 mt-1">
            No boats are open for members to take out{isStaff ? " (set them up under Settings)" : ""}.
          </p>
        ) : (
          <form
            className={`${card} mt-2 flex flex-col gap-3`}
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => signOutBoat({ boatId, rowerIds: crew, backTime: backBy, route }),
                () => {
                  setBoatId("");
                  setRoute("");
                }
              );
            }}
          >
            <label className="flex flex-col">
              Boat
              <select required value={boatId} onChange={(e) => setBoatId(e.target.value)} className="border rounded px-2 py-1 mt-1">
                <option value="">Pick a boat</option>
                {available.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.boat_class})
                    {b.min_rating > 0 ? ` · ${ratingLabel(b.min_rating)}+` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col">
              Who&apos;s rowing
              <CrewPicker people={people} value={crew} onChange={setCrew} />
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col">
                Back by
                <input type="time" required value={backBy} onChange={(e) => setBackBy(e.target.value)} className="border rounded px-2 py-1 mt-1" />
              </label>
              <label className="flex flex-col flex-1 min-w-40">
                Where (optional)
                <input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Upriver to the dam" className="border rounded px-2 py-1 mt-1" />
              </label>
            </div>
            <button type="submit" disabled={pending || !boatId} className={`${button} self-start`}>
              Sign out
            </button>
            {message && <p className="text-red-600">{message}</p>}
          </form>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Recent</h2>
        {recent.length === 0 && <p className="text-sm text-gray-500 mt-1">Nothing yet.</p>}
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {recent.map((s) => (
            <li key={s.id} className="border-b pb-1">
              <span className="font-medium">{boatName(s.boat_id)}</span> · {names(s.rower_ids, people)}
              <span className="text-gray-500">
                {" "}
                · {dayLabel(s.out_at)} {time(s.out_at)}–{s.back_at ? time(s.back_at) : ""}
                {s.meters ? ` · ${(s.meters / 1000).toFixed(1)} km` : ""}
              </span>
              {s.damage && <span className="text-red-700"> · Reported: {s.damage}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function shiftDay(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function BookTab({
  meId,
  isStaff,
  boats,
  ergs,
  people,
  day,
  today,
  dayReservations,
  mine,
}: {
  meId: string;
  isStaff: boolean;
  boats: BoathouseBoat[];
  ergs: Erg[];
  people: Person[];
  day: string;
  today: string;
  dayReservations: Reservation[];
  mine: Reservation[];
}) {
  const { message, pending, run } = useRunner();
  const bookableBoats = boats.filter((b) => !b.out_of_service && (isStaff || b.bookable));
  const bookableErgs = ergs.filter((e) => !e.out_of_service && (isStaff || e.bookable));
  const [kind, setKind] = useState<"boat" | "erg">(bookableBoats.length > 0 || bookableErgs.length === 0 ? "boat" : "erg");
  const [itemId, setItemId] = useState("");
  const [date, setDate] = useState(day);
  const [start, setStart] = useState("06:00");
  const [minutes, setMinutes] = useState(60);
  const [crew, setCrew] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const itemName = (r: Reservation) =>
    r.boat_id ? (boats.find((b) => b.id === r.boat_id)?.name ?? "A boat") : (ergs.find((e) => e.id === r.erg_id)?.name ?? "An erg");
  const byItem = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of dayReservations) {
      const key = itemName(r);
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayReservations]);
  const canCancel = (r: Reservation) => isStaff || r.booked_by === meId || r.rower_ids.includes(meId);
  const items = kind === "boat" ? bookableBoats : bookableErgs;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/boathouse?tab=book&date=${shiftDay(day, -1)}`} className="rounded border px-2 py-1 text-sm" aria-label="Day before">
            ←
          </Link>
          <h2 className="text-lg font-semibold">
            {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <Link href={`/boathouse?tab=book&date=${shiftDay(day, 1)}`} className="rounded border px-2 py-1 text-sm" aria-label="Day after">
            →
          </Link>
          {day !== today && (
            <Link href="/boathouse?tab=book" className="text-sm underline">
              Today
            </Link>
          )}
        </div>
        {byItem.length === 0 && <p className="text-sm text-gray-500 mt-2">Nothing booked this day.</p>}
        <div className="mt-2 flex flex-col gap-2">
          {byItem.map(([name, list]) => (
            <div key={name} className={card}>
              <p className="font-semibold">{name}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {list.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      {time(r.starts_at)}–{time(r.ends_at)} · {names(r.rower_ids, people)}
                      {r.note ? <span className="text-gray-500"> · {r.note}</span> : null}
                    </span>
                    {canCancel(r) && (
                      <button type="button" disabled={pending} onClick={() => run(() => cancelReservation(r.id))} className="text-gray-500 underline">
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Book</h2>
        {bookableBoats.length + bookableErgs.length === 0 ? (
          <p className="text-sm text-gray-500 mt-1">
            Nothing is open for booking yet{isStaff ? " (set boats and ergs up under Settings)" : ""}.
          </p>
        ) : (
          <form
            className={`${card} mt-2 flex flex-col gap-3`}
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  bookEquipment({
                    boatId: kind === "boat" ? itemId : null,
                    ergId: kind === "erg" ? itemId : null,
                    date,
                    time: start,
                    minutes,
                    rowerIds: kind === "boat" ? crew : [],
                    note,
                  }),
                () => {
                  setNote("");
                  setCrew([]);
                }
              );
            }}
          >
            <div className="flex gap-2">
              {(["boat", "erg"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setItemId("");
                  }}
                  className={`rounded-lg border-2 px-3 py-1 ${kind === k ? "border-[var(--color-primary)] font-semibold" : "border-gray-300"}`}
                >
                  {k === "boat" ? "Boat" : "Erg"}
                </button>
              ))}
            </div>
            <label className="flex flex-col">
              {kind === "boat" ? "Boat" : "Erg"}
              <select required value={itemId} onChange={(e) => setItemId(e.target.value)} className="border rounded px-2 py-1 mt-1">
                <option value="">Pick one</option>
                {items.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {"boat_class" in b ? ` (${b.boat_class})${b.min_rating > 0 ? ` · ${ratingLabel(b.min_rating)}+` : ""}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col">
                Day
                <input type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1 mt-1" />
              </label>
              <label className="flex flex-col">
                Start
                <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className="border rounded px-2 py-1 mt-1" />
              </label>
              <label className="flex flex-col">
                How long
                <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="border rounded px-2 py-1 mt-1">
                  {BOOKING_LENGTHS.map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {kind === "boat" && (
              <div className="flex flex-col">
                {isStaff ? "Who's rowing (you're included)" : "Rowing with you (for a double or bigger)"}
                <CrewPicker people={people.filter((p) => p.id !== meId)} value={crew} onChange={setCrew} />
              </div>
            )}
            <label className="flex flex-col">
              Note (optional)
              <input value={note} onChange={(e) => setNote(e.target.value)} className="border rounded px-2 py-1 mt-1" />
            </label>
            <button type="submit" disabled={pending || !itemId} className={`${button} self-start`}>
              Book it
            </button>
            {message && <p className="text-red-600">{message}</p>}
          </form>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Your bookings</h2>
        {mine.length === 0 && <p className="text-sm text-gray-500 mt-1">None coming up.</p>}
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {mine.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-1">
              <span>
                <span className="font-medium">{itemName(r)}</span> · {dayLabel(r.starts_at)} {time(r.starts_at)}–{time(r.ends_at)}
              </span>
              <button type="button" disabled={pending} onClick={() => run(() => cancelReservation(r.id))} className="text-gray-500 underline">
                Cancel
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SettingsTab({ boats, ergs, people }: { boats: BoathouseBoat[]; ergs: Erg[]; people: Person[] }) {
  const { message, pending, run } = useRunner();
  const [ergName, setErgName] = useState("");
  const [filter, setFilter] = useState("");
  const shownPeople = filter.trim()
    ? people.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : people;

  return (
    <div className="flex flex-col gap-8">
      {message && <p className="text-sm text-red-600">{message}</p>}
      <section>
        <h2 className="text-lg font-semibold">Boats</h2>
        <p className="text-sm text-gray-600">
          Pick which boats members can book and take out themselves, and the rating they need. Coaches and admins can
          book and take out any boat.
        </p>
        {boats.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            No boats yet. Add them on <Link href="/boats" className="underline">Boats</Link>.
          </p>
        )}
        <div className="mt-2 flex flex-col gap-2">
          {boats.map((b) => (
            <div key={b.id} className={`${card} flex flex-wrap items-center gap-x-4 gap-y-2`}>
              <p className="font-medium min-w-40 flex-1">
                {b.name} <span className="text-gray-500 font-normal">({b.boat_class})</span>
              </p>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={b.bookable}
                  disabled={pending}
                  onChange={(e) => run(() => setBoatBooking(b.id, { bookable: e.target.checked }))}
                />
                Members can book
              </label>
              <label className="flex items-center gap-1">
                Needs
                <select
                  value={b.min_rating}
                  disabled={pending}
                  onChange={(e) => run(() => setBoatBooking(b.id, { min_rating: Number(e.target.value) }))}
                  className="border rounded px-1 py-0.5"
                >
                  {RATING_LEVELS.map((r) => (
                    <option key={r.level} value={r.level}>
                      {r.level === 0 ? "Anyone" : `${r.label}+`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={b.out_of_service}
                  disabled={pending}
                  onChange={(e) => run(() => setBoatBooking(b.id, { out_of_service: e.target.checked }))}
                />
                Out of service
              </label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Ergs</h2>
        <div className="mt-2 flex flex-col gap-2">
          {ergs.map((e) => (
            <div key={e.id} className={`${card} flex flex-wrap items-center gap-x-4 gap-y-2`}>
              <p className="font-medium flex-1 min-w-32">{e.name}</p>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={e.bookable} disabled={pending} onChange={(ev) => run(() => updateErg(e.id, { bookable: ev.target.checked }))} />
                Members can book
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={e.out_of_service}
                  disabled={pending}
                  onChange={(ev) => run(() => updateErg(e.id, { out_of_service: ev.target.checked }))}
                />
                Out of service
              </label>
              <button type="button" disabled={pending} onClick={() => run(() => removeErg(e.id))} className="text-gray-500 underline">
                Remove
              </button>
            </div>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            run(() => addErg(ergName), () => setErgName(""));
          }}
        >
          <input value={ergName} onChange={(ev) => setErgName(ev.target.value)} placeholder="Erg 1" className="border rounded px-2 py-1 text-sm" />
          <button type="submit" disabled={pending || !ergName.trim()} className={button}>
            Add erg
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Rower ratings</h2>
        <p className="text-sm text-gray-600">
          {RATING_LEVELS.map((r) => `${r.label}: ${r.detail}`).join(" ")} A boat needing a level lets anyone at that
          level or higher take it.
        </p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find someone"
          className="border rounded px-2 py-1 text-sm mt-2"
        />
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {shownPeople.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 border-b pb-1">
              <span>
                {p.name} <span className="text-gray-500 capitalize">({p.role})</span>
              </span>
              <select
                value={p.rating}
                disabled={pending}
                onChange={(e) => run(() => setRating(p.id, Number(e.target.value)))}
                className="border rounded px-1 py-0.5"
              >
                {RATING_LEVELS.map((r) => (
                  <option key={r.level} value={r.level}>
                    {r.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
