"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Profile, Team } from "@/lib/database.types";
import { TEAM_LABELS } from "@/lib/teams";

type GroupFilter = Team | "board" | "all";

const FILTER_BUTTONS: { value: GroupFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mens", label: TEAM_LABELS.mens },
  { value: "womens", label: TEAM_LABELS.womens },
  { value: "development", label: TEAM_LABELS.development },
  { value: "masters", label: TEAM_LABELS.masters },
  { value: "parent", label: "Parents" },
  { value: "alumni", label: TEAM_LABELS.alumni },
  { value: "board", label: "Board Members" },
];

export type RosterProfile = Pick<
  Profile,
  | "id"
  | "email"
  | "display_name"
  | "role"
  | "phone"
  | "boat_side"
  | "disabled_at"
  | "first_name"
  | "last_name"
  | "photo_url"
  | "is_board_member"
>;

export function RosterGrid({
  profiles,
  teamsByProfile,
}: {
  profiles: RosterProfile[];
  teamsByProfile: Record<string, Team[]>;
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const matching = profiles.filter((p) => {
      if (groupFilter === "board" && !p.is_board_member) return false;
      if (groupFilter !== "all" && groupFilter !== "board" && !(teamsByProfile[p.id] ?? []).includes(groupFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        p.display_name.toLowerCase().includes(q) ||
        (p.first_name ?? "").toLowerCase().includes(q) ||
        (p.last_name ?? "").toLowerCase().includes(q)
      );
    });

    return matching.sort((a, b) =>
      (a.first_name || a.display_name).localeCompare(b.first_name || b.display_name)
    );
  }, [profiles, teamsByProfile, search, groupFilter]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-4">
        {FILTER_BUTTONS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setGroupFilter(f.value)}
            className={`text-sm rounded-full px-3 py-1.5 border-2 transition-colors ${
              groupFilter === f.value
                ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                : "border-[var(--color-primary)] hover:bg-[var(--color-secondary)] hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border rounded px-3 py-2 text-sm w-full mt-3"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 mt-4">No matching members.</p>
      ) : (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/roster/${p.id}`}
              className={`flex flex-col items-center gap-1 rounded-md p-1 text-center hover:bg-gray-100 transition-colors ${
                p.disabled_at ? "opacity-50" : ""
              }`}
            >
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo_url}
                  alt=""
                  className="w-full aspect-square rounded-full object-cover border"
                />
              ) : (
                <div className="w-full aspect-square rounded-full border flex items-center justify-center text-[9px] text-gray-400">
                  No photo
                </div>
              )}
              <span className="text-[10px] font-medium leading-tight truncate w-full">
                {p.display_name}
              </span>
              {p.disabled_at && <span className="text-[9px] text-red-600">Removed</span>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
