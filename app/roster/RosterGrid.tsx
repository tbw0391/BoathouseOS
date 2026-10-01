"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StorageImage } from "@/components/StorageImage";
import type { Profile, Team } from "@/lib/database.types";
import { TEAM_LABELS } from "@/lib/teams";

type GroupFilter = Team | "board" | "jobs" | `committee:${string}`;

const FILTER_BUTTONS: { value: GroupFilter; label: string }[] = [
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
  badgesByProfile = {},
  committees = [],
}: {
  profiles: RosterProfile[];
  teamsByProfile: Record<string, Team[]>;
  // Board title, club jobs and committees (lib/contacts.ts badgesFor).
  badgesByProfile?: Record<string, string[]>;
  committees?: { id: string; name: string; memberIds: string[] }[];
}) {
  const [search, setSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<GroupFilter[]>([]);

  function toggleGroup(group: GroupFilter) {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const matching = profiles.filter((p) => {
      const inSelectedGroup =
        selectedGroups.length === 0 ||
        selectedGroups.some((g) =>
          g === "board"
            ? p.is_board_member
            : g === "jobs"
              ? (badgesByProfile[p.id] ?? []).length > 0
              : g.startsWith("committee:")
                ? (committees.find((c) => `committee:${c.id}` === g)?.memberIds ?? []).includes(p.id)
                : (teamsByProfile[p.id] ?? []).includes(g as Team)
        );
      if (!inSelectedGroup) return false;
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
  }, [profiles, teamsByProfile, badgesByProfile, committees, search, selectedGroups]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={() => setSelectedGroups([])}
          className={`text-sm rounded-full px-3 py-1.5 border-2 transition-colors ${
            selectedGroups.length === 0
              ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
              : "border-[var(--color-primary)] hover:bg-[var(--color-secondary)] hover:text-white"
          }`}
        >
          All
        </button>
        {[
          ...FILTER_BUTTONS,
          { value: "jobs" as GroupFilter, label: "Club jobs" },
          ...committees.map((c) => ({ value: `committee:${c.id}` as GroupFilter, label: c.name })),
        ].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => toggleGroup(f.value)}
            className={`text-sm rounded-full px-3 py-1.5 border-2 transition-colors ${
              selectedGroups.includes(f.value)
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
        <div className="mt-4 -mx-4 px-4 py-4 bg-gray-50 rounded-xl grid grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/roster/${p.id}`}
              className={`flex flex-col items-center gap-2 rounded-2xl bg-white border border-gray-200 shadow-sm px-2 pt-4 pb-3 text-center hover:shadow-md active:scale-[0.98] transition min-w-0 ${
                p.disabled_at ? "opacity-50" : ""
              }`}
            >
              {p.photo_url ? (
                <StorageImage
                  src={p.photo_url}
                  alt=""
                  width={160}
                  height={160}
                  className="w-20 h-20 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-3xl font-semibold text-[var(--color-primary)]">
                  {(p.first_name || p.display_name).slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold leading-tight text-gray-900 break-words">{p.display_name}</span>
              {(badgesByProfile[p.id] ?? []).length > 0 && (
                <span className="flex flex-wrap justify-center gap-1">
                  {badgesByProfile[p.id].map((b) => (
                    <span
                      key={b}
                      className="text-[10px] leading-tight rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] px-1.5 py-0.5"
                    >
                      {b}
                    </span>
                  ))}
                </span>
              )}
              {p.disabled_at && <span className="text-[10px] text-red-600 shrink-0">(Removed)</span>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
