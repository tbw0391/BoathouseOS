import { clubByJoinCode } from "@/lib/clubs";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
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
