import { notFound } from "next/navigation";
import { publishedPage } from "@/lib/website";
import { SiteShell, loadSite, when } from "../../SiteShell";
import { SiteText } from "../../SiteText";

export const dynamic = "force-dynamic";

// A page or news post an admin published.
export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { club, preview } = await loadSite();
  const page = await publishedPage(club.id, slug);
  if (!page) notFound();
  return (
    <SiteShell club={club} preview={preview}>
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-1">{page.title}</h1>
        {page.kind === "news" && <p className="text-sm text-gray-500 mb-4">{when(page.created_at)}</p>}
        <div className="mt-4">
          <SiteText text={page.body} />
        </div>
      </article>
    </SiteShell>
  );
}
