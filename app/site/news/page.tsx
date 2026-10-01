import Link from "next/link";
import { newsPosts } from "@/lib/website";
import { SiteShell, loadSite, when } from "../SiteShell";

export const dynamic = "force-dynamic";

export default async function SiteNews() {
  const { club, preview } = await loadSite("news");
  const posts = await newsPosts(club.id, 50);
  return (
    <SiteShell club={club} preview={preview}>
      <h1 className="text-3xl font-bold mb-6">News</h1>
      {posts.length === 0 ? (
        <p className="text-gray-500">No news yet.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {posts.map((n) => (
            <li key={n.slug}>
              <Link href={`/site/p/${n.slug}`} className="text-xl font-semibold hover:underline">
                {n.title}
              </Link>
              <p className="text-xs text-gray-500">{when(n.created_at)}</p>
              <p className="text-gray-700 line-clamp-3">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </SiteShell>
  );
}
