import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { allAuthUsers, consoleUser, formatWhen } from "@/lib/console";
import { CONSOLE_HOST, IS_DEMO_SITE } from "@/lib/site";
import { addGlobalAdmin, removeGlobalAdmin } from "../actions";
import { Badge, Card, ConsolePage, NotGlobalAdmin, buttonClass, inputClass } from "../ui";

// Who can open the console and see every club.
export default async function GlobalAdminsPage() {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;

  const admin = createAdminClient();
  const [{ data: gaData }, { data: profileData }, { data: clubData }, users] = await Promise.all([
    admin.from("global_admins").select("user_id"),
    admin.from("profiles").select("id, display_name, club_id"),
    admin.from("clubs").select("id, name"),
    allAuthUsers(admin),
  ]);
  const ids = ((gaData as { user_id: string }[] | null) ?? []).map((g) => g.user_id);
  const profiles = new Map(
    ((profileData as { id: string; display_name: string; club_id: string }[] | null) ?? []).map((p) => [p.id, p])
  );
  const clubName = new Map(((clubData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const byId = new Map(users.map((u) => [u.id, u]));
  const signIn = IS_DEMO_SITE ? "boathouseos.app/login" : `${CONSOLE_HOST}/login`;

  return (
    <ConsolePage title="Global admins" subtitle="They can open the console and see and change every club.">
      <Card>
        <ul className="flex flex-col divide-y">
          {ids.map((id) => {
            const u = byId.get(id);
            const p = profiles.get(id);
            return (
              <li key={id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{u?.email ?? id}</span> {id === me.id && <Badge tone="green">you</Badge>}
                  <span className="block text-xs text-gray-500">
                    {p ? `${p.display_name} · also a member of ${clubName.get(p.club_id) ?? "a club"}` : "No club (console only)"}
                    {" · last sign-in "}
                    {formatWhen(u?.last_sign_in_at)}
                  </span>
                </span>
                {id !== me.id && (
                  <ActionForm action={removeGlobalAdmin}>
                    <input type="hidden" name="user_id" value={id} />
                    <button type="submit" className="text-xs text-red-700 border border-red-300 rounded px-2 py-1">
                      Remove global admin
                    </button>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Add a global admin">
        <ActionForm action={addGlobalAdmin} className="flex flex-wrap gap-2">
          <input name="email" type="email" required placeholder="Email" className={`${inputClass} flex-1 min-w-56`} />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </ActionForm>
        <p className="text-xs text-gray-500">
          If they don&apos;t have an account yet, one is made with no club. They set their password with
          &quot;Forgot password?&quot; at {signIn}. Removing a global admin keeps their account (and club
          membership, if any); they just lose the console.
        </p>
      </Card>
    </ConsolePage>
  );
}
