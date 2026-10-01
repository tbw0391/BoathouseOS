import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { WEBSITE_KEY, WEBSITE_SECTIONS, parseWebsiteSettings } from "@/lib/website";
import { createWebsitePage, markInquiryHandled, saveWebsiteSettings } from "./actions";

const input = "border rounded px-3 py-2 text-sm w-full";
const button =
  "bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors";

type PageRow = { id: string; kind: string; title: string; slug: string; published: boolean; updated_at: string };
type Inquiry = {
  id: string;
  kind: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
  handled_at: string | null;
};

// Admin Settings > Website: the club's public site (0112).
export default async function AdminWebsitePage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) notFound();

  const [{ data: settingRow }, { data: pageRows }, { data: inquiryRows }] = await Promise.all([
    supabase.from("club_settings").select("value").eq("key", WEBSITE_KEY).maybeSingle(),
    supabase.from("website_pages").select("id, kind, title, slug, published, updated_at").order("kind").order("sort_order").order("title"),
    supabase.from("website_inquiries").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const settings = parseWebsiteSettings((settingRow as { value: string | null } | null)?.value);
  const pages = (pageRows as PageRow[] | null) ?? [];
  const inquiries = (inquiryRows as Inquiry[] | null) ?? [];
  const open = inquiries.filter((i) => !i.handled_at);

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← Admin Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Website</h1>
        <p className="text-sm text-gray-500">
          Your club&apos;s public site, built from the app: upcoming regattas, results, coaches and board, news and
          pages you write here. It never shows members&apos; contact details or anything about minors.{" "}
          <Link href="/site" className="text-[var(--color-primary)] hover:underline">
            {settings.enabled ? "View the site →" : "Preview the site →"}
          </Link>
        </p>
      </div>

      <ActionForm action={saveWebsiteSettings} className="flex flex-col gap-4">
        <label className="border-2 rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-[var(--color-primary)]">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="w-4 h-4 mt-0.5" />
          <span>
            <span className="font-medium">Website is on</span>
            <span className="block text-xs text-gray-500">
              Visitors to your club&apos;s address see the site, with a Member sign in button. Off: they go straight
              to sign in, and only admins can preview it.
            </span>
          </span>
        </label>
        <label className="text-sm flex flex-col gap-1">
          Tagline (under the club&apos;s name)
          <input name="tagline" defaultValue={settings.tagline} maxLength={160} placeholder="Rowing on the Alum Creek since 1998" className={input} />
        </label>
        <label className="text-sm flex flex-col gap-1">
          About us
          <textarea name="about" defaultValue={settings.about} rows={6} className={input} />
          <span className="text-xs text-gray-500">Blank line = new paragraph. &quot;## &quot; starts a heading, &quot;- &quot; a bullet.</span>
        </label>
        <label className="text-sm flex flex-col gap-1">
          Join page text
          <textarea name="join_text" defaultValue={settings.joinText} rows={4} placeholder="Programs, ages, costs, when to start…" className={input} />
        </label>
        <div className="text-sm flex flex-col gap-1">
          Banner photo (wide works best)
          <input type="file" name="hero" accept="image/*" className="text-sm" />
          {settings.heroPath && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" name="remove_hero" /> Remove the current photo
            </label>
          )}
        </div>
        <fieldset className="border rounded-lg px-4 py-3 text-sm flex flex-col gap-2">
          <legend className="font-medium px-1">Sections</legend>
          {WEBSITE_SECTIONS.map((s) => (
            <label key={s.key} className="flex items-start gap-2">
              <input type="checkbox" name={`section:${s.key}`} defaultChecked={settings.sections[s.key]} className="w-4 h-4 mt-0.5" />
              <span>
                {s.label} <span className="text-xs text-gray-500">{s.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className={`${button} self-start`}>
          Save
        </button>
      </ActionForm>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pages and news</h2>
        {pages.length === 0 && <p className="text-sm text-gray-500">None yet. Pages show in the site&apos;s menu; news on the home page.</p>}
        <ul className="divide-y border rounded-lg">
          {pages.map((p) => (
            <li key={p.id} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
              <Link href={`/admin/website/${p.id}`} className="font-medium hover:underline">
                {p.title}
              </Link>
              <span className="text-xs text-gray-500">
                {p.kind === "news" ? "News" : "Page"} · {p.published ? "Published" : "Draft"}
              </span>
            </li>
          ))}
        </ul>
        <ActionForm action={createWebsitePage} className="flex flex-wrap gap-2">
          <input name="title" required placeholder="Title, e.g. Learn to Row" className={`${input} flex-1 min-w-48 w-auto`} />
          <select name="kind" className="border rounded px-2 py-2 text-sm">
            <option value="page">Page</option>
            <option value="news">News post</option>
          </select>
          <button type="submit" className={button}>
            Add
          </button>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Messages from the site ({open.length} new)</h2>
        {inquiries.length === 0 && <p className="text-sm text-gray-500">No messages yet. New ones are also emailed to the club&apos;s admins.</p>}
        <ul className="flex flex-col gap-2">
          {inquiries.map((i) => (
            <li key={i.id} className={`border rounded-lg p-3 text-sm ${i.handled_at ? "opacity-60" : ""}`}>
              <p className="font-medium">
                {i.name ?? "No name"} <span className="text-xs text-gray-500">· {i.kind === "join" ? "Wants to join" : "Contact"}</span>
              </p>
              <p className="text-gray-600">
                {i.email && (
                  <a href={`mailto:${i.email}`} className="underline mr-3">
                    {i.email}
                  </a>
                )}
                {i.phone && (
                  <a href={`tel:${i.phone}`} className="underline">
                    {i.phone}
                  </a>
                )}
              </p>
              {i.message && <p className="whitespace-pre-line mt-1">{i.message}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{new Date(i.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
                <ActionForm action={markInquiryHandled}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="handled" value={i.handled_at ? "0" : "1"} />
                  <button type="submit" className="text-xs border rounded px-2 py-1">
                    {i.handled_at ? "Mark new" : "Mark handled"}
                  </button>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
