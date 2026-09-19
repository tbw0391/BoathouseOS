import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { AddMemberForm } from "./AddMemberForm";

const ROLE_LABELS: Record<Profile["role"], string> = {
  rower: "Rower",
  coxswain: "Coxswain",
  coach: "Coach",
  parent: "Parent",
  admin: "Admin",
};

export default async function RosterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .is("disabled_at", null)
    .order("display_name", { ascending: true });

  const profiles = (data as Profile[] | null) ?? [];
  const currentProfile = profiles.find((p) => p.id === user?.id);
  const canManage = currentProfile?.role === "admin" || currentProfile?.role === "coach";

  return (
    <div className="min-h-screen p-8">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Home
      </Link>
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-2xl font-bold">Roster</h1>
        <span className="text-sm text-gray-500">{profiles.length} members</span>
      </div>

      {canManage && <AddMemberForm />}

      {error && (
        <p className="text-sm text-red-600 mt-4">
          Couldn&apos;t load roster: {error.message}
        </p>
      )}

      {!error && profiles.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">No members yet.</p>
      )}

      {profiles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Side</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Email</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{p.display_name}</td>
                  <td className="py-2 pr-4">{ROLE_LABELS[p.role]}</td>
                  <td className="py-2 pr-4 capitalize">{p.boat_side ?? "—"}</td>
                  <td className="py-2 pr-4">{p.phone ?? "—"}</td>
                  <td className="py-2 pr-4">{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
