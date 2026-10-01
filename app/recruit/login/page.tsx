"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// College coaches sign in here (club members use their club's address).
export default function RecruitLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/recruit");
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">College coach sign-in</h1>
        <input
          type="email"
          placeholder="School email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2 bg-white"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border rounded px-3 py-2 bg-white"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-[#022e5d] text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <Link href="/forgot-password" className="text-sm text-gray-500 hover:underline text-center">
          Forgot password?
        </Link>
        <Link href="/recruit/signup" className="text-sm text-gray-500 hover:underline text-center">
          New here? Sign up as a college coach
        </Link>
      </form>
    </main>
  );
}
