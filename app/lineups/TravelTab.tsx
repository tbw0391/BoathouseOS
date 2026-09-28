"use client";

import { useState, useTransition } from "react";
import type { RegattaTravel, TravelRoom, TravelVehicle } from "@/lib/database.types";
import { clubLocalStamp } from "@/lib/ical";
import { CLUB_TIME_ZONE } from "@/lib/raceDay";
import {
  addRoom,
  addVehicle,
  leaveSeat,
  removeRoom,
  removeVehicle,
  saveTripDetails,
  setRoom,
  takeSeat,
} from "./travelActions";

type Person = { id: string; name: string };
export type VehicleView = TravelVehicle & { driverName: string | null; riders: Person[] };
export type RoomView = TravelRoom & { members: Person[] };

const chip = (active: boolean) =>
  `rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
    active
      ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
      : "border-gray-300 hover:border-[var(--color-primary)]"
  }`;

function whenLabel(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: CLUB_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// datetime-local value in club time.
function inputValue(iso: string | null) {
  if (!iso) return "";
  const s = clubLocalStamp(new Date(iso));
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}`;
}

export function TravelTab({
  eventId,
  canManage,
  meId,
  trip,
  vehicles,
  rooms,
  myPeople,
  roster,
}: {
  eventId: string;
  canManage: boolean;
  meId: string;
  trip: RegattaTravel | null;
  vehicles: VehicleView[];
  rooms: RoomView[];
  myPeople: Person[];
  roster: Person[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editingTrip, setEditingTrip] = useState(false);
  const [offering, setOffering] = useState<null | "car" | "bus">(null);
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [vehicleSeats, setVehicleSeats] = useState(4);
  const [roomLabel, setRoomLabel] = useState("");
  const [roomCapacity, setRoomCapacity] = useState(4);
  const [openRoom, setOpenRoom] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>, after?: () => void) {
    setMessage(null);
    start(async () => {
      try {
        await fn();
        after?.();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const rideOf = new Map<string, string>();
  for (const v of vehicles) for (const r of v.riders) rideOf.set(r.id, v.id);
  const roomOf = new Map<string, RoomView>();
  for (const room of rooms) for (const m of room.members) roomOf.set(m.id, room);
  const unroomed = roster.filter((p) => !roomOf.has(p.id));

  const hasTrip = trip && (trip.depart_at || trip.depart_from || trip.return_at || trip.hotel_name || trip.notes);

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      {message && <p className="text-sm text-red-600">{message}</p>}

      {/* Trip details */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trip</h2>
          {canManage && !editingTrip && (
            <button type="button" onClick={() => setEditingTrip(true)} className="text-sm underline">
              Edit
            </button>
          )}
        </div>
        {editingTrip ? (
          <form
            className="flex flex-col gap-2 text-sm"
            action={(fd) => run(() => saveTripDetails(eventId, fd), () => setEditingTrip(false))}
          >
            <label className="flex flex-col gap-1">
              Leave at
              <input type="datetime-local" name="depart_at" defaultValue={inputValue(trip?.depart_at ?? null)} className="border rounded px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              Leave from
              <input name="depart_from" defaultValue={trip?.depart_from ?? ""} placeholder="Boathouse parking lot" className="border rounded px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              Back at
              <input type="datetime-local" name="return_at" defaultValue={inputValue(trip?.return_at ?? null)} className="border rounded px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              Hotel
              <input name="hotel_name" defaultValue={trip?.hotel_name ?? ""} className="border rounded px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              Hotel address
              <input name="hotel_address" defaultValue={trip?.hotel_address ?? ""} className="border rounded px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              Notes (what to bring, meals, curfew)
              <textarea name="notes" rows={4} defaultValue={trip?.notes ?? ""} className="border rounded px-2 py-1" />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={() => setEditingTrip(false)} className="text-sm underline">
                Cancel
              </button>
            </div>
          </form>
        ) : hasTrip ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {trip!.depart_at && (
              <>
                <dt className="text-gray-500">Leave</dt>
                <dd>
                  {whenLabel(trip!.depart_at)}
                  {trip!.depart_from && `, ${trip!.depart_from}`}
                </dd>
              </>
            )}
            {!trip!.depart_at && trip!.depart_from && (
              <>
                <dt className="text-gray-500">Leave from</dt>
                <dd>{trip!.depart_from}</dd>
              </>
            )}
            {trip!.return_at && (
              <>
                <dt className="text-gray-500">Back</dt>
                <dd>{whenLabel(trip!.return_at)}</dd>
              </>
            )}
            {trip!.hotel_name && (
              <>
                <dt className="text-gray-500">Hotel</dt>
                <dd>
                  {trip!.hotel_name}
                  {trip!.hotel_address && (
                    <>
                      {" · "}
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(trip!.hotel_address)}`}
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {trip!.hotel_address}
                      </a>
                    </>
                  )}
                </dd>
              </>
            )}
            {trip!.notes && <dd className="col-span-2 whitespace-pre-line mt-1">{trip!.notes}</dd>}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">No trip details yet.</p>
        )}
      </section>

      {/* Rides */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Rides</h2>
        {vehicles.length === 0 && <p className="text-sm text-gray-500">No rides yet.</p>}
        {vehicles.map((v) => {
          const full = v.riders.length >= v.seats;
          const mine = v.driver_id === meId;
          return (
            <div key={v.id} className="rounded-lg border-2 border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  {v.label}
                  {v.driverName && <span className="text-gray-500 font-normal"> · driver {v.driverName}</span>}
                </p>
                <span className={full ? "text-red-700" : "text-gray-600"}>
                  {v.riders.length}/{v.seats} seats
                </span>
              </div>
              {v.riders.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {v.riders.map((r) => (
                    <li key={r.id} className="rounded-full bg-gray-100 px-2 py-0.5 flex items-center gap-1">
                      {r.name}
                      {(canManage || mine) && (
                        <button
                          type="button"
                          aria-label={`Take ${r.name} out of ${v.label}`}
                          onClick={() => run(() => leaveSeat(eventId, v.id, r.id))}
                          className="text-gray-500"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {myPeople.map((p) => {
                  const here = rideOf.get(p.id) === v.id;
                  const label = p.id === meId ? "me" : p.name.split(" ")[0];
                  if (here) {
                    return (
                      <button key={p.id} type="button" disabled={pending} onClick={() => run(() => leaveSeat(eventId, v.id, p.id))} className={chip(true)}>
                        ✓ {label} (leave)
                      </button>
                    );
                  }
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={pending || full}
                      onClick={() => run(() => takeSeat(eventId, v.id, p.id))}
                      className={chip(false) + " disabled:opacity-40"}
                    >
                      + {label}
                    </button>
                  );
                })}
                {(canManage || mine) && (
                  <button type="button" onClick={() => run(() => removeVehicle(eventId, v.id))} className="text-sm text-gray-500 underline ml-auto">
                    Remove ride
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {offering ? (
          <form
            className="rounded-lg border-2 border-gray-200 p-3 flex flex-col gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addVehicle(eventId, vehicleLabel, vehicleSeats, offering === "car"),
                () => {
                  setOffering(null);
                  setVehicleLabel("");
                }
              );
            }}
          >
            <input
              value={vehicleLabel}
              onChange={(e) => setVehicleLabel(e.target.value)}
              maxLength={60}
              placeholder={offering === "car" ? "Name it (default: your name's car)" : "Bus, Club van, …"}
              className="border rounded px-3 py-2"
            />
            <p className="text-gray-600">{offering === "car" ? "Seats for riders:" : "Seats:"}</p>
            <div className="flex flex-wrap gap-2">
              {(offering === "car" ? [1, 2, 3, 4, 5, 6, 7] : [7, 12, 15, 24, 36, 48, 56]).map((n) => (
                <button key={n} type="button" onClick={() => setVehicleSeats(n)} className={chip(vehicleSeats === n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="bg-[var(--color-primary)] text-white rounded px-4 py-2 font-medium disabled:opacity-50">
                Add
              </button>
              <button type="button" onClick={() => setOffering(null)} className="underline">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setOffering("car");
                setVehicleSeats(4);
              }}
              className={chip(false)}
            >
              + I can drive
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setOffering("bus");
                  setVehicleSeats(56);
                }}
                className={chip(false)}
              >
                + Bus or van
              </button>
            )}
          </div>
        )}
      </section>

      {/* Rooms */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Rooms</h2>
        {myPeople
          .filter((p) => roomOf.has(p.id))
          .map((p) => (
            <p key={p.id} className="text-sm">
              {p.id === meId ? "You're" : `${p.name} is`} in <strong>{roomOf.get(p.id)!.label}</strong>
              {" with "}
              {roomOf
                .get(p.id)!
                .members.filter((m) => m.id !== p.id)
                .map((m) => m.name)
                .join(", ") || "no one else yet"}
              .
            </p>
          ))}
        {rooms.length === 0 && <p className="text-sm text-gray-500">No rooms yet.</p>}
        {rooms.map((room) => (
          <div key={room.id} className="rounded-lg border-2 border-gray-200 p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">{room.label}</p>
              <span className="text-gray-600">
                {room.members.length}/{room.capacity}
              </span>
            </div>
            <ul className="mt-1 flex flex-wrap gap-1">
              {room.members.map((m) => (
                <li key={m.id} className="rounded-full bg-gray-100 px-2 py-0.5 flex items-center gap-1">
                  {m.name}
                  {canManage && (
                    <button type="button" aria-label={`Take ${m.name} out`} onClick={() => run(() => setRoom(eventId, null, m.id))} className="text-gray-500">
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="mt-2 flex flex-wrap gap-2">
                {room.members.length < room.capacity && (
                  <button type="button" onClick={() => setOpenRoom(openRoom === room.id ? null : room.id)} className={chip(openRoom === room.id)}>
                    {openRoom === room.id ? "Done" : "+ Add people"}
                  </button>
                )}
                <button type="button" onClick={() => run(() => removeRoom(eventId, room.id))} className="text-sm text-gray-500 underline ml-auto">
                  Remove room
                </button>
              </div>
            )}
            {canManage && openRoom === room.id && room.members.length < room.capacity && (
              <div className="mt-2 flex flex-wrap gap-1">
                {unroomed.length === 0 && <span className="text-gray-500">Everyone has a room.</span>}
                {unroomed.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setRoom(eventId, room.id, p.id))}
                    className="rounded-full border border-gray-300 px-2 py-0.5 hover:border-[var(--color-primary)]"
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {canManage && (
          <form
            className="flex flex-wrap items-center gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addRoom(eventId, roomLabel || `Room ${rooms.length + 1}`, roomCapacity), () => setRoomLabel(""));
            }}
          >
            <input
              value={roomLabel}
              onChange={(e) => setRoomLabel(e.target.value)}
              maxLength={60}
              placeholder={`Room ${rooms.length + 1}`}
              className="border rounded px-3 py-2 w-40"
            />
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" onClick={() => setRoomCapacity(n)} className={chip(roomCapacity === n)}>
                {n}
              </button>
            ))}
            <button type="submit" disabled={pending} className={chip(false)}>
              + Add room
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
