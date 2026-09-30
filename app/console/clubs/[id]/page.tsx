import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { parseThemeColors, THEME_COLOR_LABELS, type ThemeColorKey } from "@/lib/theme";
import { allAuthUsers, consoleUser, daysAgo, formatWhen } from "@/lib/console";
import { IS_DEMO_SITE, clubAddress } from "@/lib/site";
import { deleteClub, setClubSuspended, updateClub, updateClubBranding, updateClubColors } from "../../actions";
import { NewPasswordButton } from "../NewPasswordButton";
import { Badge, Card, ConsolePage, NotGlobalAdmin, Stat, buttonClass, inputClass, outlineButtonClass } from "../../ui";

type Club = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  suspended_at: string | null;
  app_name: string | null;
  app_short_name: string | null;
  icon_path: string | null;
};
type Person = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  approved_at: string | null;
  disabled_at: string | null;
};
type EventRow = { id: string; title: string; starts_at: string; event_type: string; location: string | null };

// One club, read and managed with the service role.
export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: clubRow } = await admin
    .from("clubs")
    .select("id, name, slug, created_at, suspended_at, app_name, app_short_name, icon_path")
    .eq("id", id)
    .maybeSingle();
  const club = clubRow as Club | null;
  if (!club) notFound();

  const monthAgo = daysAgo(30);
  const count = async (table: string, since?: string) => {
    let q = admin.from(table).select("*", { count: "exact", head: true }).eq("club_id", id);
    if (since) q = q.gte("created_at", since);
    return (await q).count ?? 0;
  };

  const [
    { data: peopleData },
    { data: eventData },
    { data: boatData },
    { data: themeRow },
    { data: payRow },
    icon,
    users,
    lineups,
    races,
    messages,
    photos,
    polls,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, email, phone, role, approved_at, disabled_at")
      .eq("club_id", id)
      .order("display_name"),
    admin
      .from("schedule_events")
      .select("id, title, starts_at, event_type, location")
      .eq("club_id", id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
    admin.from("boats").select("name").eq("club_id", id).order("name"),
    admin.from("club_settings").select("value").eq("club_id", id).eq("key", "theme_colors").maybeSingle(),
    admin.from("payment_settings").select("stripe_account_id, stripe_charges_enabled").eq("club_id", id).maybeSingle(),
    club.icon_path
      ? admin.storage.from("club-icons").createSignedUrl(club.icon_path, 60 * 60)
      : Promise.resolve({ data: null }),
    allAuthUsers(admin),
    count("lineups"),
    count("races"),
    count("messages", monthAgo),
    count("photos"),
    count("polls"),
  ]);
  const people = (peopleData as Person[] | null) ?? [];
  const active = people.filter((p) => p.approved_at && !p.disabled_at);
  const waiting = people.filter((p) => !p.approved_at && !p.disabled_at);
  const removed = people.filter((p) => p.disabled_at);
  const events = (eventData as EventRow[] | null) ?? [];
  const boats = ((boatData as { name: string }[] | null) ?? []).map((b) => b.name);
  const theme = parseThemeColors((themeRow as { value: string | null } | null)?.value);
  const pay = payRow as { stripe_account_id: string | null; stripe_charges_enabled: boolean } | null;
  const iconUrl = (icon.data as { signedUrl: string } | null)?.signedUrl ?? null;
  const lastSignIn = new Map(users.map((u) => [u.id, u.last_sign_in_at]));
  const weekAgo = daysAgo(7);
  const activeThisWeek = active.filter((p) => (lastSignIn.get(p.id) ?? "") > weekAgo).length;
  const address = clubAddress(club.slug);

  return (
    <ConsolePage
      title={club.name}
      back={{ href: "/console/clubs", label: "Clubs" }}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {IS_DEMO_SITE ? (
            <span>{address}</span>
          ) : (
            <a href={`https://${address}`} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">
              {address}
            </a>
          )}
          <span>· since {new Date(club.created_at).toLocaleDateString()}</span>
          {club.suspended_at && <Badge tone="red">suspended {formatWhen(club.suspended_at)}</Badge>}
        </span>
      }
    >
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Stat label="Members" value={active.length} href={`/console/members?club=${club.id}`} />
        <Stat label="Waiting" value={waiting.length} href={`/console/members?club=${club.id}&status=waiting`} />
        <Stat label="Active this week" value={activeThisWeek} />
        <Stat label="Messages (30 days)" value={messages} />
        <Stat label="Lineups" value={lineups} />
        <Stat label="Races" value={races} />
        <Stat label="Photos" value={photos} />
        <Stat label="Polls" value={polls} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Name and address">
          <ActionForm action={updateClub} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={club.id} />
            <label className="text-sm flex flex-col gap-1">
              Club name
              <input name="name" defaultValue={club.name} required className={inputClass} />
            </label>
            <label className="text-sm flex flex-col gap-1">
              Address
              <span className="flex items-center gap-1">
                <input name="slug" defaultValue={club.slug} required className={`${inputClass} flex-1 min-w-0`} />
                <span className="text-gray-500">.boathouseos.app</span>
              </span>
            </label>
            {!IS_DEMO_SITE && (
              <p className="text-xs text-gray-500">
                Changing the address also needs a CNAME for the new name at Namecheap and the domain added to the
                boathouseos-prod project in Vercel, or members can&apos;t reach it. Members on the old address
                don&apos;t get forwarded.
              </p>
            )}
            <button type="submit" className={`${buttonClass} self-start`}>
              Save
            </button>
          </ActionForm>
        </Card>

        <Card title="App name and icon">
          <div className="flex items-center gap-3">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt="" width={64} height={64} className="w-16 h-16 rounded-xl border" />
            ) : (
              <div className="w-16 h-16 rounded-xl border flex items-center justify-center text-xs text-gray-400">
                none
              </div>
            )}
            <div className="text-sm">
              <p className="font-medium">{club.app_name ?? "BoathouseOS (default)"}</p>
              <p className="text-gray-500">Home screen: {club.app_short_name ?? club.app_name ?? "BoathouseOS"}</p>
            </div>
          </div>
          <ActionForm action={updateClubBranding} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={club.id} />
            <input name="app_name" defaultValue={club.app_name ?? ""} placeholder="App name, e.g. Westerville Crew" className={inputClass} />
            <input
              name="app_short_name"
              defaultValue={club.app_short_name ?? ""}
              placeholder="Home-screen name (12 letters), e.g. W-Crew"
              maxLength={12}
              className={inputClass}
            />
            <label className="text-sm flex flex-col gap-1">
              New icon (square PNG or JPG, optional)
              <input type="file" name="icon" accept="image/*" className="text-sm" />
            </label>
            <button type="submit" className={`${buttonClass} self-start`}>
              Save
            </button>
          </ActionForm>
        </Card>

        <Card title="Colors">
          <ActionForm action={updateClubColors} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={club.id} />
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(THEME_COLOR_LABELS) as ThemeColorKey[]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="color" name={`color:${k}`} defaultValue={theme[k]} className="w-10 h-8 border rounded" />
                  {THEME_COLOR_LABELS[k]}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" name="reset" />
              Go back to the BoathouseOS colors
            </label>
            <button type="submit" className={`${buttonClass} self-start`}>
              Save colors
            </button>
          </ActionForm>
        </Card>

        <Card title="Card payments">
          {pay?.stripe_charges_enabled ? (
            <p className="text-sm">
              <Badge tone="green">connected</Badge> Families can pay by card. Stripe account{" "}
              <span className="font-mono text-xs">{pay.stripe_account_id}</span>
            </p>
          ) : pay?.stripe_account_id ? (
            <p className="text-sm">
              <Badge tone="amber">unfinished</Badge> Stripe setup started but Stripe still needs details from the club
              (account <span className="font-mono text-xs">{pay.stripe_account_id}</span>).
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Not connected. The club&apos;s treasurer or admin connects it on Manage payments.
            </p>
          )}
        </Card>
      </div>

      <Card title={`Members (${active.length})`}>
        <PeopleList people={active} lastSignIn={lastSignIn} address={address} />
        {waiting.length > 0 && (
          <>
            <h3 className="font-medium">Waiting for approval ({waiting.length})</h3>
            <PeopleList people={waiting} lastSignIn={lastSignIn} address={address} />
          </>
        )}
        {removed.length > 0 && (
          <>
            <h3 className="font-medium">Removed from roster ({removed.length})</h3>
            <PeopleList people={removed} lastSignIn={lastSignIn} address={address} />
          </>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Coming up">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing on the schedule.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {events.map((e) => (
                <li key={e.id} className="border rounded px-3 py-2">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-gray-500">
                    {" "}
                    · {formatWhen(e.starts_at)}
                    {e.location && ` · ${e.location}`}
                    {` · ${e.event_type}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Boats">
          <p className="text-sm text-gray-600">{boats.length ? boats.join(", ") : "None yet."}</p>
        </Card>
      </div>

      <Card title="Suspend or delete" tone="danger">
        {club.suspended_at ? (
          <ActionForm action={setClubSuspended} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={club.id} />
            <input type="hidden" name="suspend" value="0" />
            <p className="text-sm">Everyone in this club is locked out until you lift the suspension.</p>
            <button type="submit" className={`${outlineButtonClass} self-start`}>
              Lift suspension
            </button>
          </ActionForm>
        ) : (
          <ActionForm action={setClubSuspended} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={club.id} />
            <input type="hidden" name="suspend" value="1" />
            <p className="text-sm text-gray-600">
              Locks out every member (they see &quot;waiting for approval&quot;) without deleting anything. Undo any
              time.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" required />
              Lock out everyone in {club.name}
            </label>
            <button type="submit" className="self-start bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium">
              Suspend club
            </button>
          </ActionForm>
        )}
        {people.length === 0 ? (
          <ActionForm action={deleteClub} className="flex flex-col gap-2 border-t pt-3">
            <input type="hidden" name="id" value={club.id} />
            <p className="text-sm text-gray-600">This club has no members, so it can be deleted for good.</p>
            <input name="confirm_name" placeholder={`Type ${club.name} to confirm`} className={inputClass} />
            <button type="submit" className="self-start bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium">
              Delete club
            </button>
          </ActionForm>
        ) : (
          <p className="text-xs text-gray-500 border-t pt-3">
            Clubs with members can&apos;t be deleted here (their data would go with it). Suspend instead.
          </p>
        )}
      </Card>
    </ConsolePage>
  );
}

function PeopleList({
  people,
  lastSignIn,
  address,
}: {
  people: Person[];
  lastSignIn: Map<string, string | null>;
  address: string;
}) {
  if (people.length === 0) return <p className="text-sm text-gray-500">No one.</p>;
  return (
    <ul className="flex flex-col divide-y text-sm">
      {people.map((p) => (
        <li key={p.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
          <span>
            <Link href={`/console/members/${p.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
              {p.display_name}
            </Link>{" "}
            <Badge tone={p.role === "admin" ? "blue" : "gray"}>{p.role}</Badge>
            <span className="block text-xs text-gray-500 break-all">
              {[p.email, p.phone].filter(Boolean).join(" · ")}
              {lastSignIn.has(p.id) && ` · last sign-in ${formatWhen(lastSignIn.get(p.id))}`}
            </span>
          </span>
          {p.role === "admin" && p.email && <NewPasswordButton profileId={p.id} name={p.display_name} signInAt={address} />}
        </li>
      ))}
    </ul>
  );
}
