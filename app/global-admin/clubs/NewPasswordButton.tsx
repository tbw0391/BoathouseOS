"use client";

import { useState, useTransition } from "react";
import { newAdminPassword } from "../actions";
import { unwrap } from "@/lib/userError";
import { PasswordNote } from "./CreateClubForm";

export function NewPasswordButton({ profileId, name }: { profileId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (result) {
    return (
      <div className="w-full">
        <PasswordNote heading={`New password for ${name}.`} email={result.email} password={result.password} />
      </div>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirming) return setConfirming(true);
          setError(null);
          startTransition(async () => {
            try {
              setResult(unwrap(await newAdminPassword(profileId)));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          });
        }}
        className="text-xs border rounded px-2 py-1 disabled:opacity-50"
      >
        {confirming ? "Tap again: replaces their password" : "New password"}
      </button>
    </span>
  );
}
