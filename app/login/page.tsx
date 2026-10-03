"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScanFace } from "lucide-react";
import { SELF_SIGNUP_OPEN } from "@/lib/signup";
import { IS_DEMO_SITE } from "@/lib/site";
import { ClubLogo } from "@/components/ClubBranding";
import { createClient } from "@/lib/supabase/client";
import { ClearRuntimeCaches } from "@/components/ClearRuntimeCaches";
import { TryDemoButton } from "@/components/TryDemoButton";
import {
  biometricName,
  passkeyCancelled,
  passkeyErrorMessage,
  passkeyRememberedHere,
  passkeysSupported,
} from "@/lib/passkey";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // "Face ID", "fingerprint"...: only on devices where a member turned it on.
  const [passkeyName, setPasskeyName] = useState<string | null>(null);

  useEffect(() => {
    if (passkeysSupported() && passkeyRememberedHere()) setPasskeyName(biometricName());
  }, []);

  async function handlePasskey() {
    if (!passkeyName) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPasskey();
    setLoading(false);
    if (error) {
      if (!passkeyCancelled(error)) setError(passkeyErrorMessage(error, passkeyName));
      return;
    }
    router.push("/");
    router.refresh();
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
      <ClearRuntimeCaches />
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <ClubLogo />

        {IS_DEMO_SITE && (
          <>
            <TryDemoButton />
            <p className="text-center text-xs text-gray-400">or sign in with an account</p>
          </>
        )}

        {passkeyName && (
          <>
            <button
              type="button"
              onClick={handlePasskey}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] rounded px-3 py-3 font-medium disabled:opacity-50"
            >
              <ScanFace className="w-5 h-5" />
              Sign in with {passkeyName}
            </button>
            <p className="text-center text-xs text-gray-400">or with your password</p>
          </>
        )}

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
        {SELF_SIGNUP_OPEN && (
          <Link
            href="/signup"
            className="border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded px-3 py-2 text-center font-medium hover:bg-gray-50"
          >
            New here? Create an account
          </Link>
        )}
      </form>
    </div>
  );
}
