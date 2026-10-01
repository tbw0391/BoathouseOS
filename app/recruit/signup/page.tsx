"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { unwrap } from "@/lib/userError";
import { recruiterSignUp } from "../actions";

// College coaches sign up with their school email. The "set your password"
// email proves the address is theirs; a BoathouseOS admin then approves them.
export default function RecruitSignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (sentTo) {
    return (
      <main className="max-w-md mx-auto px-4 py-12 flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-gray-700">
          We sent a link to <strong>{sentTo}</strong>. Open it to set your password. Then a BoathouseOS
          admin checks your details, usually within a day, and you&apos;ll get an email when you can see
          athletes.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const { email } = unwrap(await recruiterSignUp(formData));
              const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
              });
              if (resetError) throw new Error("Your account is made, but the email didn't send. Use \"Forgot password?\" to get the link.");
              setSentTo(email);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong.");
            }
          });
        }}
      >
        <h1 className="text-2xl font-bold">Sign up as a college coach</h1>
        <p className="text-sm text-gray-600">
          See rowers and coxswains whose clubs use BoathouseOS and who chose to be listed, and contact their
          club coach and parents.
        </p>
        <input name="name" required placeholder="Your name" className="border rounded px-3 py-2 bg-white" />
        <input name="school" required placeholder="College or university" className="border rounded px-3 py-2 bg-white" />
        <input name="title" placeholder="Title (e.g. Assistant Coach, Women's Rowing)" className="border rounded px-3 py-2 bg-white" />
        <input name="email" type="email" required placeholder="School email (.edu)" className="border rounded px-3 py-2 bg-white" />
        {/* Honeypot: hidden from people, filled in by bots. */}
        <input name="middle_name" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agree_terms" required className="mt-1" />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline" target="_blank">
              Privacy Policy
            </Link>
            , and I&apos;ll only use this for recruiting.
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#022e5d] text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
        >
          {isPending ? "Signing up..." : "Sign up"}
        </button>
        <p className="text-xs text-gray-500">
          Your school doesn&apos;t use a .edu address? Email privacy@boathouseos.app.
        </p>
        <Link href="/recruit/login" className="text-sm text-gray-500 hover:underline text-center">
          Already signed up? Sign in
        </Link>
      </form>
    </main>
  );
}
