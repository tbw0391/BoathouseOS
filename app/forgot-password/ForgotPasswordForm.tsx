"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm({ logoUrl, clubName }: { logoUrl: string; clubName: string }) {
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    // Always show the same success message regardless of whether the email
    // matches an account — Supabase itself doesn't reveal that either, to
    // avoid letting someone probe which emails are registered.
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={clubName} className="w-32 h-auto mx-auto" />

        {sent ? (
          <p className="text-sm text-center">
            If that email has an account, we&apos;ve sent a link to reset the password. Check your
            inbox (and spam folder).
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-gray-500 text-center">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            {linkError && <p className="text-sm text-red-600 text-center">{linkError}</p>}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border rounded px-3 py-2"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="text-sm text-gray-500 hover:underline text-center">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
