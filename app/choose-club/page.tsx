import { cookies } from "next/headers";
import { DEMO_CLUBS, DEMO_CLUB_COOKIE } from "@/lib/demoClubs";
import { ClubPicker } from "./ClubPicker";

export default async function ChooseClubPage() {
  const current = (await cookies()).get(DEMO_CLUB_COOKIE)?.value ?? null;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Pick your club</h1>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        See BoathouseOS in your club&apos;s colors. You can change this any time from the home
        page.
      </p>
      <ClubPicker clubs={DEMO_CLUBS} current={current} />
    </div>
  );
}
