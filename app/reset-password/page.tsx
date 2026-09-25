"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(
        error.message.includes("session")
          ? "This reset link has expired or was already used — request a new one."
          : error.message
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <Image
          src="/branding/logo-full.png"
          alt="BoatHouseOS"
          width={789}
          height={205}
          priority
          className="w-64 h-auto mx-auto"
        />

        <p className="text-sm text-gray-500 text-center">Set a new password.</p>

        <input
          type="password"
          placeholder="New password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Set new password"}
        </button>
      </form>
    </div>
  );
}
