import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { deleteWebsitePage, saveWebsitePage } from "../actions";

const input = "border rounded px-3 py-2 text-sm w-full";

// Editing one page or news post on the club website (0112).
export default async function EditWebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) notFound();
  const { data } = await supabase.from("website_pages").select("*").eq("id", id).maybeSingle();
  const page = data as {
    id: string;
    kind: string;
    slug: string;
    title: string;
    body: string;
    published: boolean;
    sort_order: number;
  } | null;
  if (!page) notFound();

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/admin/website" className="text-sm text-gray-500 hover:underline">
          ← Website
        </Link>
        <h1 className="text-2xl font-bold mt-2">{page.kind === "news" ? "News post" : "Page"}</h1>
        {page.published && (
          <Link href={`/site/p/${page.slug}`} className="text-sm text-[var(--color-primary)] hover:underline">
            View it on the site →
          </Link>
        )}
      </div>

      <ActionForm action={saveWebsitePage} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={page.id} />
        <label className="text-sm flex flex-col gap-1">
          Title
          <input name="title" required defaultValue={page.title} maxLength={120} className={input} />
        </label>
        <label className="text-sm flex flex-col gap-1">
          Text
          <textarea name="body" defaultValue={page.body} rows={16} className={`${input} font-mono`} />
          <span className="text-xs text-gray-500">
            Blank line = new paragraph. &quot;## &quot; starts a heading, &quot;- &quot; a bullet. Web addresses become links.
          </span>
        </label>
        {page.kind === "page" && (
          <label className="text-sm flex items-center gap-2">
            Menu order
            <input name="sort_order" type="number" defaultValue={page.sort_order} className="w-20 border rounded px-2 py-1" />
            <span className="text-xs text-gray-500">lower comes first</span>
          </label>
        )}
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={page.published} className="w-4 h-4" />
          Published (visible on the site)
        </label>
        <button
          type="submit"
          className="self-start bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
        >
          Save
        </button>
      </ActionForm>

      <ActionForm action={deleteWebsitePage} className="border-t pt-4">
        <input type="hidden" name="id" value={page.id} />
        <button type="submit" className="text-sm text-red-700 border border-red-300 rounded px-3 py-1.5">
          Delete this {page.kind === "news" ? "post" : "page"}
        </button>
      </ActionForm>
    </div>
  );
}
