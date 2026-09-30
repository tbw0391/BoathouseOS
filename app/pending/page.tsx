import { ClubLogo } from "@/components/ClubBranding";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

// Where middleware sends signed-in people who aren't approved yet, who
// were removed from the roster, or whose club is suspended (0107).
export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name, disabled_at").eq("id", user.id).maybeSingle()
    : { data: null };
  const removed = Boolean((profile as { disabled_at: string | null } | null)?.disabled_at);
  const { data: club } = user ? await supabase.from("clubs").select("suspended_at").maybeSingle() : { data: null };
  const suspended = Boolean((club as { suspended_at: string | null } | null)?.suspended_at);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm flex flex-col gap-4 text-center">
        <ClubLogo />
        {suspended ? (
          <>
            <h1 className="text-xl font-bold">Your club&apos;s account is paused</h1>
            <p className="text-sm text-gray-600">
              The app is turned off for your club for now. Your club&apos;s admins can contact BoathouseOS
              about turning it back on.
            </p>
          </>
        ) : removed ? (
          <>
            <h1 className="text-xl font-bold">Your account is inactive</h1>
            <p className="text-sm text-gray-600">
              You&apos;ve been removed from the roster. If you think this is a mistake, contact a
              coach or club admin.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">
              Thanks{(profile as { display_name: string } | null)?.display_name
                ? `, ${(profile as { display_name: string }).display_name}`
                : ""}
              !
            </h1>
            <p className="text-sm text-gray-600">
              Your account is waiting for a club admin to approve it. Check back once they&apos;ve
              let you in.
            </p>
          </>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
