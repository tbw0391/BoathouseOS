import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseStoreItems } from "@/lib/storeItems";
import { StoreLinkForm } from "./StoreLinkForm";
import { FeaturedItemsForm } from "./FeaturedItemsForm";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const isAdmin = (callerProfile as { role: string } | null)?.role === "admin";

  const { data: settings } = await supabase
    .from("club_settings")
    .select("key, value")
    .in("key", ["team_store_url", "team_store_featured_items"]);

  const settingsByKey = new Map(
    ((settings as { key: string; value: string | null }[] | null) ?? []).map((s) => [s.key, s.value])
  );
  const storeUrl = settingsByKey.get("team_store_url") ?? null;
  const featuredItems = parseStoreItems(settingsByKey.get("team_store_featured_items") ?? null);

  if (storeUrl && edit !== "1") {
    redirect(storeUrl);
  }

  return (
    <div className="min-h-screen p-8">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold mt-4">Team Store</h1>

      {!storeUrl && <p className="text-sm text-gray-500 mt-2">No store link set yet.</p>}

      {isAdmin ? (
        <>
          <StoreLinkForm currentUrl={storeUrl} />
          <FeaturedItemsForm currentItems={featuredItems} />
        </>
      ) : (
        !storeUrl && <p className="text-sm text-gray-500 mt-2">Check back soon.</p>
      )}
    </div>
  );
}
