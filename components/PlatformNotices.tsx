import { createClient } from "@/lib/supabase/server";
import { DismissNoticeButton } from "@/components/DismissNoticeButton";

// Announcements from BoathouseOS (sent from the console, 0107) for this
// member's club and role, until they dismiss them. The database only
// returns the ones meant for them.
export async function PlatformNotices() {
  const supabase = await createClient();
  const [{ data: noticeData }, { data: dismissData }] = await Promise.all([
    supabase.from("platform_notices").select("id, title, body").order("created_at", { ascending: false }),
    supabase.from("platform_notice_dismissals").select("notice_id"),
  ]);
  const dismissed = new Set(((dismissData as { notice_id: string }[] | null) ?? []).map((d) => d.notice_id));
  const notices = ((noticeData as { id: string; title: string; body: string }[] | null) ?? []).filter(
    (n) => !dismissed.has(n.id)
  );
  if (notices.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-2">
      {notices.map((n) => (
        <div key={n.id} className="border-2 border-[var(--color-primary)] bg-white rounded-lg px-4 py-3 text-sm flex gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">From BoathouseOS</p>
            <p className="font-semibold">{n.title}</p>
            <p className="whitespace-pre-line">{n.body}</p>
          </div>
          <DismissNoticeButton noticeId={n.id} />
        </div>
      ))}
    </div>
  );
}
