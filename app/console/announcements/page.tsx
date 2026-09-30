import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/ActionForm";
import { consoleUser, formatWhen } from "@/lib/console";
import { deleteNotice } from "../actions";
import { NoticeForm } from "./NoticeForm";
import { Badge, Card, ConsolePage, NotGlobalAdmin } from "../ui";

type Notice = {
  id: string;
  title: string;
  body: string;
  audience: string;
  club_id: string | null;
  expires_at: string | null;
  created_at: string;
};

// Messages from BoathouseOS to clubs (0107): shown on members' home page
// until they dismiss it or it expires, optionally also as a phone alert or
// email.
export default async function AnnouncementsPage() {
  const me = await consoleUser();
  if (!me) return <NotGlobalAdmin />;

  const admin = createAdminClient();
  const [{ data: clubData }, { data: noticeData }, { data: dismissData }] = await Promise.all([
    admin.from("clubs").select("id, name").order("name"),
    admin.from("platform_notices").select("*").order("created_at", { ascending: false }),
    admin.from("platform_notice_dismissals").select("notice_id"),
  ]);
  const clubs = (clubData as { id: string; name: string }[] | null) ?? [];
  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  const notices = (noticeData as Notice[] | null) ?? [];
  const dismissals = (dismissData as { notice_id: string }[] | null) ?? [];
  const now = new Date().toISOString();

  return (
    <ConsolePage
      title="Announcements"
      subtitle="Shown at the top of members' home page until they dismiss it (or it expires)."
    >
      <NoticeForm clubs={clubs} />

      <Card title={`Sent (${notices.length})`}>
        {notices.length === 0 ? (
          <p className="text-sm text-gray-500">None yet.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {notices.map((n) => {
              const expired = n.expires_at && n.expires_at < now;
              return (
                <li key={n.id} className="py-3 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    <Badge tone="blue">{n.audience === "everyone" ? "everyone" : "admins"}</Badge>
                    <Badge>{n.club_id ? clubName.get(n.club_id) ?? "a club" : "every club"}</Badge>
                    {expired && <Badge tone="red">expired</Badge>}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{n.body}</p>
                  <p className="text-xs text-gray-500">
                    {formatWhen(n.created_at)}
                    {n.expires_at && ` · ${expired ? "expired" : "until"} ${formatWhen(n.expires_at)}`} ·{" "}
                    {dismissals.filter((d) => d.notice_id === n.id).length} dismissed
                  </p>
                  <ActionForm action={deleteNotice}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="text-xs text-red-700 hover:underline">
                      Take down
                    </button>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </ConsolePage>
  );
}
