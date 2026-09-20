"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { signUp } from "./actions";
import { TEAM_LABELS, TEAM_OPTIONS } from "@/lib/teams";

const ROLE_OPTIONS = [
  { value: "rower", label: "Rower" },
  { value: "coxswain", label: "Coxswain" },
  { value: "parent", label: "Parent" },
];

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);

    try {
      await signUp(formData);

      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form
        action={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <Image
          src="/branding/logo-full.png"
          alt="Westerville Crew"
          width={480}
          height={530}
          priority
          className="w-32 h-auto mx-auto"
        />
        <h1 className="text-xl font-bold text-center">Join Westerville Crew</h1>

        <div className="flex gap-2">
          <input
            name="first_name"
            placeholder="First name"
            required
            className="border rounded px-3 py-2 flex-1"
          />
          <input
            name="last_name"
            placeholder="Last name"
            required
            className="border rounded px-3 py-2 flex-1"
          />
        </div>

        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          name="password"
          placeholder="Password (min 8 characters)"
          required
          minLength={8}
          className="border rounded px-3 py-2"
        />

        <select name="role" defaultValue="rower" className="border rounded px-3 py-2">
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Group (optional)</span>
          <div className="flex flex-wrap gap-3">
            {TEAM_OPTIONS.map((team) => (
              <label key={team} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="team" value={team} />
                {TEAM_LABELS[team]}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-[#404040] text-white border-2 border-[#022e5d] rounded px-3 py-2 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <Link href="/login" className="text-sm text-gray-500 hover:underline text-center">
          Already have an account? Sign in
        </Link>
      </form>
    </div>
  );
}
