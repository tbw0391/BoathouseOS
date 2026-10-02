import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clubDateKey } from "@/lib/raceDay";
import { RateClicker } from "./RateClicker";

export const dynamic = "force-dynamic";

// Rate & Split: a coach in the launch taps at each catch for stroke rate,
// and the phone's GPS (keeping pace with the boat) gives the split.
export default async function RatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (me as { role: string } | null)?.role;
  if (role !== "coach" && role !== "admin") redirect("/coach");

  const { data: boatsData } = await supabase.from("boats").select("id, name").order("name");

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-md mx-auto flex flex-col gap-4">
      <div>
        <Link href="/coach" className="text-sm text-gray-500 hover:underline">
          ← Coach
        </Link>
        <h1 className="text-2xl font-bold mt-4">Rate &amp; Split</h1>
        <p className="text-sm text-gray-600 mt-1">
          Tap the pad at each catch. Keep pace with the boat and your phone&apos;s GPS gives the split.
        </p>
      </div>
      <RateClicker boats={(boatsData as { id: string; name: string }[] | null) ?? []} today={clubDateKey(new Date())} />
    </div>
  );
}
