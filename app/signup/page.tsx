import Link from "next/link";
import { clubByJoinCode } from "@/lib/clubs";
import { SELF_SIGNUP_OPEN } from "@/lib/signup";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  if (!SELF_SIGNUP_OPEN) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="max-w-sm">
          Signing up here isn&apos;t open right now. Ask your club&apos;s admin or coach to add you.
        </p>
        <Link href="/login" className="text-sm text-gray-500 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const { join } = await searchParams;
  const club = join ? await clubByJoinCode(join) : null;

  if (join && !club) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="max-w-sm text-center">
          This invite link isn&apos;t valid anymore. Ask your club for a new one.
        </p>
      </div>
    );
  }

  return <SignupForm joinCode={club ? join! : null} clubName={club?.name ?? null} />;
}
