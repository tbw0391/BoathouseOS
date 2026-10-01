import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { IS_DEMO_SITE } from "@/lib/site";

// The recruit pages' header (0121): BoathouseOS and signing out, no club's
// look or navigation.
export async function RecruitHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 bg-[#022e5d] text-white print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <Link href="/recruit" className="flex items-center gap-2">
          <Image src="/branding/mark-white.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
          <span className="font-semibold">BoathouseOS Recruiting</span>
          {IS_DEMO_SITE && <span className="text-xs bg-white/20 rounded px-1.5 py-0.5">demo</span>}
        </Link>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-white/70">{user.email}</span>
            <form action={signOut} className="inline-flex">
              <button type="submit" aria-label="Log out" className="inline-flex">
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
