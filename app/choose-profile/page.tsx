import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_PROFILES, isDemoEmail } from "@/lib/demoAccount";
import { ProfilePicker } from "./ProfilePicker";

export default async function ChooseProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isDemoEmail(user?.email)) redirect("/");

  const current = DEMO_PROFILES.find((p) => p.email === user!.email)?.role ?? null;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Who are you?</h1>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        Each type of member gets different buttons and pages. Pick one to see the app the way
        they do. You can switch any time from the home page.
      </p>
      <ProfilePicker
        profiles={DEMO_PROFILES.map(({ role, label, blurb }) => ({ role, label, blurb }))}
        current={current}
      />
    </div>
  );
}
