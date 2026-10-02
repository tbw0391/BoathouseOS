import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { MessageLogEntry, MessageLogView, Profile } from "@/lib/database.types";

// Board members only (0122): every chat message ever sent in the club,
// including ones deleted from the chat, for looking into a SafeSport or
// conduct concern. Opening or searching it is recorded, and the board sees
// that history at the bottom.

const LIMIT = 300;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function MessageLogPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; q?: string; from?: string; to?: string }>;
}) {
  const { person = "", q = "", from = "", to = "" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isBoard } = await supabase.rpc("is_board_member");
  if (!isBoard) {
    return (
      <div className="min-h-screen p-8">
        <Link href="/messages" className="text-sm text-gray-500 hover:underline">
          ← Messages
        </Link>
        <h1 className="text-2xl font-bold mt-2">Message log</h1>
        <p className="text-sm text-gray-600 mt-4">Only board members can open the message log.</p>
      </div>
    );
  }

  const { data: peopleData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name", { ascending: true });
  const people = (peopleData as Pick<Profile, "id" | "display_name">[] | null) ?? [];
  const personName = people.find((p) => p.id === person)?.display_name ?? "";

  const { data: me } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
  const searched = [
    personName && `person: ${personName}`,
    q.trim() && `text: "${q.trim()}"`,
    isDate(from) && `from ${from}`,
    isDate(to) && `to ${to}`,
  ]
    .filter(Boolean)
    .join(", ");
  await supabase.from("message_log_views").insert({
    viewer_id: user.id,
    viewer_name: (me as { display_name: string } | null)?.display_name ?? "Unknown",
    searched,
  });

  let query = supabase
    .from("message_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(LIMIT);
  if (people.some((p) => p.id === person)) {
    query = query.or(`sender_id.eq.${person},member_ids.cs.{${person}}`);
  }
  if (q.trim()) query = query.ilike("body", `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  if (isDate(from)) query = query.gte("sent_at", `${from}T00:00:00-05:00`);
  if (isDate(to)) query = query.lte("sent_at", `${to}T23:59:59-05:00`);
  const { data: entriesData } = await query;
  const entries = (entriesData as MessageLogEntry[] | null) ?? [];

  const { data: viewsData } = await supabase
    .from("message_log_views")
    .select("*")
    .order("viewed_at", { ascending: false })
    .limit(25);
  const views = (viewsData as MessageLogView[] | null) ?? [];

  return (
    <div className="min-h-screen p-8">
      <Link href="/messages" className="text-sm text-gray-500 hover:underline">
        ← Messages
      </Link>
      <h1 className="text-2xl font-bold mt-2">Message log</h1>
      <p className="text-sm text-gray-600 mt-1 max-w-2xl">
        A copy of every chat message in the club, including deleted ones, kept for SafeSport.
        Only board members can see it, and every time it&apos;s opened is recorded below.
        Members can&apos;t change or delete these copies.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 max-w-3xl">
        <label className="flex flex-col text-sm">
          Person (sent or in the chat)
          <select name="person" defaultValue={person} className="border rounded px-2 py-1 mt-1 min-w-48">
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          Words
          <input name="q" defaultValue={q} className="border rounded px-2 py-1 mt-1" />
        </label>
        <label className="flex flex-col text-sm">
          From
          <input type="date" name="from" defaultValue={from} className="border rounded px-2 py-1 mt-1" />
        </label>
        <label className="flex flex-col text-sm">
          To
          <input type="date" name="to" defaultValue={to} className="border rounded px-2 py-1 mt-1" />
        </label>
        <button className="rounded bg-[var(--color-primary)] text-white px-4 py-1.5 text-sm">Search</button>
        {(person || q || from || to) && (
          <Link href="/messages/log" prefetch={false} className="text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <p className="text-sm text-gray-600 mt-6">
        {entries.length === 0
          ? "No messages match."
          : entries.length === LIMIT
            ? `Showing the newest ${LIMIT}. Narrow the search to see older ones.`
            : `${entries.length} message${entries.length === 1 ? "" : "s"}, newest first.`}
      </p>

      <div className="mt-3 flex flex-col gap-2 max-w-3xl">
        {entries.map((e) => {
          const others = e.member_names.filter((n) => n !== e.sender_name);
          const chat = e.is_direct || !e.group_name || e.group_name === "New chat" ? null : e.group_name;
          return (
            <div key={e.message_id} className="border rounded-lg p-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
                <span>{when(e.sent_at)}</span>
                {chat && <span>· {chat}</span>}
                {e.removed_at && (
                  <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5">
                    Deleted from the chat {when(e.removed_at)}
                  </span>
                )}
              </div>
              <p className="mt-1">
                <span className="font-medium">{e.sender_name}</span>
                {e.sender_role && <span className="text-gray-500"> ({e.sender_role})</span>}
                <span className="text-gray-500"> to {others.length > 0 ? others.join(", ") : "nobody else"}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap">{e.body}</p>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold mt-10">Who opened the log</h2>
      <ul className="mt-2 text-sm flex flex-col gap-1 max-w-3xl">
        {views.map((v) => (
          <li key={v.id}>
            {when(v.viewed_at)}: {v.viewer_name}
            <span className="text-gray-500">{v.searched ? ` searched ${v.searched}` : " opened it"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
