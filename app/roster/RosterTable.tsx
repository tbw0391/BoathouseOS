"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Profile, Team } from "@/lib/database.types";
import { TEAM_LABELS, TEAM_OPTIONS } from "@/lib/teams";

const ROLE_LABELS: Record<Profile["role"], string> = {
  rower: "Rower",
  coxswain: "Coxswain",
  coach: "Coach",
  parent: "Parent",
  admin: "Admin",
};

type SortKey = "first" | "last";

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
>;

export function RosterTable({
  profiles,
  teamsByProfile,
}: {
  profiles: RosterProfile[];
  teamsByProfile: Record<string, Team[]>;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("first");
  const [groupFilter, setGroupFilter] = useState<Team | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const matching = profiles.filter((p) => {
      if (groupFilter !== "all" && !(teamsByProfile[p.id] ?? []).includes(groupFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        p.display_name.toLowerCase().includes(q) ||
        (p.first_name ?? "").toLowerCase().includes(q) ||
        (p.last_name ?? "").toLowerCase().includes(q)
      );
    });

    return matching.sort((a, b) => {
      const aKey = (sortBy === "first" ? a.first_name : a.last_name) || a.display_name;
      const bKey = (sortBy === "first" ? b.first_name : b.last_name) || b.display_name;
      return aKey.localeCompare(bKey);
    });
  }, [profiles, teamsByProfile, search, sortBy, groupFilter]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-4">
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1 min-w-[180px]"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="first">Sort: First name</option>
          <option value="last">Sort: Last name</option>
        </select>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value as Team | "all")}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All groups</option>
          {TEAM_OPTIONS.map((team) => (
            <option key={team} value={team}>
              {TEAM_LABELS[team]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 mt-4">No matching members.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4"></th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Group</th>
                <th className="py-2 pr-4">Side</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Email</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b last:border-0 ${p.disabled_at ? "opacity-50" : ""}`}
                >
                  <td className="py-2 pr-4">
                    <Link href={`/roster/${p.id}`}>
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full border flex items-center justify-center text-[10px] text-gray-400">
                          —
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    <Link href={`/roster/${p.id}`} className="hover:underline">
                      {p.display_name}
                    </Link>
                    {p.disabled_at && (
                      <span className="ml-2 text-xs text-red-600 font-normal">Removed</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{ROLE_LABELS[p.role]}</td>
                  <td className="py-2 pr-4">
                    {(teamsByProfile[p.id] ?? []).map((t) => TEAM_LABELS[t]).join(", ") || "—"}
                  </td>
                  <td className="py-2 pr-4 capitalize">{p.boat_side ?? "—"}</td>
                  <td className="py-2 pr-4">{p.phone ?? "—"}</td>
                  <td className="py-2 pr-4">{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
