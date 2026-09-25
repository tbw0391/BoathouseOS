"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signInAsDemo } from "./actions";

export function LoginForm({ logoUrl, clubName }: { logoUrl: string; clubName: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoPending, startDemo] = useTransition();

  function handleDemo() {
    setError(null);
    startDemo(async () => {
      try {
        await signInAsDemo();
      } catch (err) {
        // redirect() inside the action surfaces as a thrown NEXT_REDIRECT;
        // let Next handle that, and only show real failures.
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        setError("Couldn't open the demo. Please try again.");
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={clubName} className="w-32 h-auto mx-auto" />

        <button
          type="button"
          onClick={handleDemo}
          disabled={demoPending}
          className="bg-[var(--color-primary)] text-white rounded px-3 py-3 text-lg font-medium disabled:opacity-50"
        >
          {demoPending ? "Opening demo..." : "Try the demo"}
        </button>
        <p className="text-center text-xs text-gray-400">or sign in with an account</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <Link href="/forgot-password" className="text-sm text-gray-500 hover:underline text-center">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-sm text-gray-500 hover:underline text-center">
          New here? Create an account
        </Link>
      </form>
    </div>
  );
}
