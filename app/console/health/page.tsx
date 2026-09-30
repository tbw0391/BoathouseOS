import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { allAuthUsers, consoleUser, daysAgo, formatWhen } from "@/lib/console";
import { IS_DEMO_SITE } from "@/lib/site";
import { emailConfigured } from "@/lib/email";
import { smsConfigured } from "@/lib/sms";
import { Badge, Card, ConsolePage, NotGlobalAdmin, Stat } from "../ui";

// Which kind of Stripe key is set, never the key itself.
function stripeKeyKind(): { label: string; tone: "green" | "amber" | "red" | "gray" } {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) return { label: "not set (card payments off)", tone: "gray" };
  if (key.startsWith("sk_test_")) return { label: "test mode secret key", tone: IS_DEMO_SITE ? "green" : "amber" };
  if (key.startsWith("sk_live_")) return { label: "LIVE secret key (real money)", tone: IS_DEMO_SITE ? "red" : "green" };
  if (key.startsWith("rk_live_")) return { label: "live restricted key (rk_live_): wrong kind", tone: "red" };
  if (key.startsWith("rk_test_")) return { label: "test restricted key (rk_test_): wrong kind", tone: "red" };
  if (key.startsWith("pk_")) return { label: "publishable key (pk_): wrong kind", tone: "red" };
  return { label: "unrecognized value", tone: "red" };
}

function Service({ name, on, detail }: { name: string; on: boolean; detail?: string }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span>{name}</span>
      <span className="flex items-center gap-2 text-right">
        {detail && <span className="text-xs text-gray-500">{detail}</span>}
        <Badge tone={on ? "green" : "gray"}>{on ? "on" : "off"}</Badge>
      </span>
    </li>
  );
}

export default async function HealthPage() {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;

  const admin = createAdminClient();
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);
  const [{ data: clubData }, { data: peopleData }, { data: pushData }, { data: msgData }, { data: errorData }, { data: migData }, users] =
    await Promise.all([
      admin.from("clubs").select("id, name, suspended_at").order("name"),
      admin.from("profiles").select("id, club_id, approved_at, disabled_at"),
      admin.from("push_subscriptions").select("user_id"),
      admin.from("messages").select("club_id").gte("created_at", weekAgo),
      admin.from("error_reports").select("id, last_seen").is("resolved_at", null),
      admin.rpc("console_applied_migrations"),
      allAuthUsers(admin),
    ]);
  const clubs = (clubData as { id: string; name: string; suspended_at: string | null }[] | null) ?? [];
  const people =
    (peopleData as { id: string; club_id: string; approved_at: string | null; disabled_at: string | null }[] | null) ?? [];
  const withPush = new Set(((pushData as { user_id: string }[] | null) ?? []).map((p) => p.user_id));
  const messages = (msgData as { club_id: string }[] | null) ?? [];
  const openErrors = (errorData as { id: string; last_seen: string }[] | null) ?? [];
  const migrations = (migData as { name: string; applied_at: string | null }[] | null) ?? [];
  const lastSignIn = new Map(users.map((u) => [u.id, u.last_sign_in_at ?? ""]));

  const stripe = stripeKeyKind();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;

  return (
    <ConsolePage title="Site health" subtitle={IS_DEMO_SITE ? "Demo site" : "Production"}>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Open errors" value={openErrors.length} href="/console/errors" />
        <Stat
          label="Signed in this week"
          value={people.filter((p) => p.approved_at && !p.disabled_at && lastSignIn.get(p.id)! > weekAgo).length}
        />
        <Stat label="Phones with alerts on" value={people.filter((p) => withPush.has(p.id)).length} />
        <Stat label="Messages this week" value={messages.length} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="What's deployed">
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-gray-500">Site</dt>
            <dd>{IS_DEMO_SITE ? "demo (main branch)" : "production (production branch)"}</dd>
            <dt className="text-gray-500">Commit</dt>
            <dd className="break-all">
              {sha ? (
                <a
                  href={`https://github.com/tbw0391/BoathouseOS/commit/${sha}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[var(--color-primary)] hover:underline"
                >
                  {sha.slice(0, 7)}
                </a>
              ) : (
                "unknown (not on Vercel)"
              )}
              {process.env.VERCEL_GIT_COMMIT_MESSAGE && (
                <span className="text-gray-600"> {process.env.VERCEL_GIT_COMMIT_MESSAGE.split("\n")[0]}</span>
              )}
            </dd>
            <dt className="text-gray-500">Database</dt>
            <dd>
              {migrations.length} migrations applied
              {migrations.length > 0 && (
                <span className="text-gray-600">
                  , latest {migrations[migrations.length - 1].name}
                  {migrations[migrations.length - 1].applied_at &&
                    ` (${formatWhen(migrations[migrations.length - 1].applied_at)})`}
                </span>
              )}
            </dd>
          </dl>
        </Card>

        <Card title="Services">
          <ul className="text-sm divide-y">
            <li className="flex items-center justify-between gap-2 py-1.5">
              <span>Stripe key</span>
              <Badge tone={stripe.tone}>{stripe.label}</Badge>
            </li>
            <Service name="Stripe webhook secret" on={!!process.env.STRIPE_WEBHOOK_SECRET} />
            <Service name="Phone alerts (push)" on={!!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY} />
            <Service name="Email (Resend)" on={emailConfigured()} detail={process.env.EMAIL_FROM} />
            <Service name="Texts (Twilio)" on={smsConfigured()} />
            <Service name="Concept2 erg sync" on={!!process.env.CONCEPT2_CLIENT_ID && !!process.env.CONCEPT2_CLIENT_SECRET} />
          </ul>
        </Card>
      </div>

      <Card title="Usage by club">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2 pr-3 font-medium">Club</th>
                <th className="py-2 pr-3 font-medium">Members</th>
                <th className="py-2 pr-3 font-medium">Signed in 7 days</th>
                <th className="py-2 pr-3 font-medium">Signed in 30 days</th>
                <th className="py-2 pr-3 font-medium">Never signed in</th>
                <th className="py-2 pr-3 font-medium">Alerts on</th>
                <th className="py-2 pr-3 font-medium">Messages 7 days</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((c) => {
                const active = people.filter((p) => p.club_id === c.id && p.approved_at && !p.disabled_at);
                const withLogin = active.filter((p) => lastSignIn.has(p.id));
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <Link href={`/console/clubs/${c.id}`} className="text-[var(--color-primary)] hover:underline">
                        {c.name}
                      </Link>{" "}
                      {c.suspended_at && <Badge tone="red">suspended</Badge>}
                    </td>
                    <td className="py-2 pr-3">{active.length}</td>
                    <td className="py-2 pr-3">{active.filter((p) => lastSignIn.get(p.id)! > weekAgo).length}</td>
                    <td className="py-2 pr-3">{active.filter((p) => lastSignIn.get(p.id)! > monthAgo).length}</td>
                    <td className="py-2 pr-3">{withLogin.filter((p) => !lastSignIn.get(p.id)).length}</td>
                    <td className="py-2 pr-3">{active.filter((p) => withPush.has(p.id)).length}</td>
                    <td className="py-2 pr-3">{messages.filter((m) => m.club_id === c.id).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          &quot;Never signed in&quot; counts members who have a login but haven&apos;t used it; roster-only members
          (no login) aren&apos;t counted.
        </p>
      </Card>
    </ConsolePage>
  );
}
