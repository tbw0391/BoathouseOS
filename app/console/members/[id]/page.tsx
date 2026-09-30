import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { ROLES, consoleUser, formatWhen } from "@/lib/console";
import { clubAddress } from "@/lib/site";
import { setMemberRole, setMemberStatus } from "../../actions";
import { NewPasswordButton } from "../../clubs/NewPasswordButton";
import { Badge, Card, ConsolePage, NotGlobalAdmin, buttonClass, inputClass, outlineButtonClass } from "../../ui";

type Person = {
  id: string;
  club_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  approved_at: string | null;
  disabled_at: string | null;
  created_at: string | null;
};

// One member: their club, login and status, and what a global admin can
// change for them.
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, club_id, display_name, first_name, last_name, email, phone, role, approved_at, disabled_at, created_at")
    .eq("id", id)
    .maybeSingle();
  const person = data as Person | null;
  if (!person) notFound();

  const [{ data: clubRow }, { data: authData }, { data: teamData }, { data: gaRow }] = await Promise.all([
    admin.from("clubs").select("id, name, slug, suspended_at").eq("id", person.club_id).single(),
    admin.auth.admin.getUserById(person.id),
    admin.from("profile_teams").select("team").eq("profile_id", person.id),
    admin.from("global_admins").select("user_id").eq("user_id", person.id).maybeSingle(),
  ]);
  const club = clubRow as { id: string; name: string; slug: string; suspended_at: string | null };
  const login = authData?.user ?? null;
  const teams = ((teamData as { team: string }[] | null) ?? []).map((t) => t.team);
  const status = person.disabled_at ? "removed" : person.approved_at ? "active" : "waiting";

  return (
    <ConsolePage
      title={person.display_name}
      back={{ href: "/console/members", label: "Members" }}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/console/clubs/${club.id}`} className="text-[var(--color-primary)] hover:underline">
            {club.name}
          </Link>
          <Badge tone={person.role === "admin" ? "blue" : "gray"}>{person.role}</Badge>
          {status === "waiting" && <Badge tone="amber">waiting for approval</Badge>}
          {status === "removed" && <Badge tone="red">removed</Badge>}
          {gaRow && <Badge tone="green">global admin</Badge>}
          {club.suspended_at && <Badge tone="red">club suspended</Badge>}
        </span>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Details">
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-gray-500">Email</dt>
            <dd className="break-all">{person.email ?? "none"}</dd>
            <dt className="text-gray-500">Phone</dt>
            <dd>{person.phone ?? "none"}</dd>
            <dt className="text-gray-500">Teams</dt>
            <dd>{teams.length ? teams.join(", ") : "none"}</dd>
            <dt className="text-gray-500">Added</dt>
            <dd>{formatWhen(person.created_at)}</dd>
            <dt className="text-gray-500">Approved</dt>
            <dd>{person.approved_at ? formatWhen(person.approved_at) : "not yet"}</dd>
            <dt className="text-gray-500">Login</dt>
            <dd>{login ? `yes, since ${formatWhen(login.created_at)}` : "none (roster only)"}</dd>
            <dt className="text-gray-500">Last sign-in</dt>
            <dd>{login ? formatWhen(login.last_sign_in_at) : "n/a"}</dd>
          </dl>
        </Card>

        <Card title="Role">
          <ActionForm action={setMemberRole} className="flex flex-wrap gap-2 items-center">
            <input type="hidden" name="id" value={person.id} />
            <select name="role" defaultValue={person.role} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass}>
              Change role
            </button>
          </ActionForm>
          <p className="text-xs text-gray-500">Admins manage their club&apos;s settings, roster and approvals.</p>
        </Card>

        <Card title="Status">
          {status === "waiting" && (
            <ActionForm action={setMemberStatus}>
              <input type="hidden" name="id" value={person.id} />
              <input type="hidden" name="change" value="approve" />
              <button type="submit" className={buttonClass}>
                Approve
              </button>
            </ActionForm>
          )}
          {status === "active" && (
            <ActionForm action={setMemberStatus} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={person.id} />
              <input type="hidden" name="change" value="remove" />
              <p className="text-sm text-gray-600">Removing locks them out and takes them off the roster. Nothing is deleted.</p>
              <button type="submit" className={`${outlineButtonClass} self-start`}>
                Remove from club
              </button>
            </ActionForm>
          )}
          {status === "removed" && (
            <ActionForm action={setMemberStatus}>
              <input type="hidden" name="id" value={person.id} />
              <input type="hidden" name="change" value="restore" />
              <button type="submit" className={buttonClass}>
                Restore
              </button>
            </ActionForm>
          )}
        </Card>

        <Card title="Password">
          {login && person.email ? (
            <>
              <p className="text-sm text-gray-600">
                Makes a temporary password for you to pass on. Their old password stops working.
              </p>
              <NewPasswordButton profileId={person.id} name={person.display_name} signInAt={clubAddress(club.slug)} />
            </>
          ) : (
            <p className="text-sm text-gray-500">They don&apos;t have a login.</p>
          )}
        </Card>
      </div>
      <p className="text-xs text-gray-500">
        Moving someone to another club isn&apos;t possible here: everything they&apos;ve done (lineups, messages,
        payments) belongs to their club. Remove them here and have the other club add them with a different email.
      </p>
    </ConsolePage>
  );
}
