import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, allAuthUsers, consoleUser, formatWhen } from "@/lib/console";
import { Badge, ConsolePage, NotGlobalAdmin, inputClass, outlineButtonClass } from "../ui";

type Person = {
  id: string;
  club_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  approved_at: string | null;
  disabled_at: string | null;
};

const STATUSES = [
  { id: "active", label: "Members" },
  { id: "waiting", label: "Waiting for approval" },
  { id: "removed", label: "Removed" },
  { id: "all", label: "Everyone" },
];

function statusOf(p: Person) {
  return p.disabled_at ? "removed" : p.approved_at ? "active" : "waiting";
}

// Everyone in every club, searchable.
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; club?: string; status?: string; role?: string }>;
}) {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;
  const { q = "", club = "", status = "active", role = "" } = await searchParams;

  const admin = createAdminClient();
  const [{ data: clubData }, { data: peopleData }, users] = await Promise.all([
    admin.from("clubs").select("id, name").order("name"),
    admin
      .from("profiles")
      .select("id, club_id, display_name, email, phone, role, approved_at, disabled_at")
      .order("display_name"),
    allAuthUsers(admin),
  ]);
  const clubs = (clubData as { id: string; name: string }[] | null) ?? [];
  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  const lastSignIn = new Map(users.map((u) => [u.id, u.last_sign_in_at]));
  const hasLogin = new Set(users.map((u) => u.id));

  const needle = q.trim().toLowerCase();
  const matches = ((peopleData as Person[] | null) ?? []).filter(
    (p) =>
      (!club || p.club_id === club) &&
      (status === "all" || statusOf(p) === status) &&
      (!role || p.role === role) &&
      (!needle ||
        p.display_name.toLowerCase().includes(needle) ||
        (p.email ?? "").toLowerCase().includes(needle) ||
        (p.phone ?? "").replace(/\D/g, "").includes(needle.replace(/\D/g, "") || "\u0000"))
  );
  const shown = matches.slice(0, 300);

  return (
    <ConsolePage title="Members" subtitle={`${matches.length} found${matches.length > shown.length ? `, showing ${shown.length}` : ""}`}>
      <form className="flex flex-wrap gap-2 items-end bg-white border border-gray-200 rounded-lg p-3">
        <input name="q" defaultValue={q} placeholder="Name, email or phone" className={`${inputClass} flex-1 min-w-48`} />
        <select name="club" defaultValue={club} className={inputClass}>
          <option value="">All clubs</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="role" defaultValue={role} className={inputClass}>
          <option value="">Any role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" className={outlineButtonClass}>
          Search
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Club</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Email / phone</th>
              <th className="px-3 py-2 font-medium">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-gray-500">
                  No one matches.
                </td>
              </tr>
            )}
            {shown.map((p) => {
              const st = statusOf(p);
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link href={`/console/members/${p.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                      {p.display_name}
                    </Link>{" "}
                    {st === "waiting" && <Badge tone="amber">waiting</Badge>}
                    {st === "removed" && <Badge tone="red">removed</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/console/clubs/${p.club_id}`} className="hover:underline">
                      {clubName.get(p.club_id) ?? "?"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.role}</td>
                  <td className="px-3 py-2 text-gray-600 break-all">{[p.email, p.phone].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {hasLogin.has(p.id) ? formatWhen(lastSignIn.get(p.id)) : <span className="text-gray-400">no login</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ConsolePage>
  );
}
