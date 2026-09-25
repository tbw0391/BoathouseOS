"use client";

import { useState, useTransition } from "react";

function generatePassword(): string {
  // Excludes visually-ambiguous characters (0/O, 1/l/I) since this gets
  // read back over text/in person, not copy-pasted from an email.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function ResetPasswordButton({
  name,
  onReset,
}: {
  name: string;
  onReset: (password: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await onReset(password);
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setDone(false);
          setPassword(generatePassword());
        }}
        className="w-52 text-center text-sm border-2 border-[var(--color-primary)] rounded px-3 py-2"
      >
        Reset password
      </button>
    );
  }

  if (done) {
    return (
      <div className="border rounded-lg p-3 max-w-xs flex flex-col gap-2 text-sm">
        <p>
          {name}&apos;s password has been reset. Share this with them directly — it won&apos;t be
          shown again:
        </p>
        <p className="font-mono bg-gray-100 rounded px-2 py-1 select-all">{password}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="self-start text-sm text-gray-500 hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-3 max-w-xs flex flex-col gap-2">
      <label className="text-sm font-medium">New password for {name}</label>
      <div className="flex gap-2">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="border rounded px-2 py-1 text-sm font-mono flex-1"
        />
        <button
          type="button"
          onClick={() => setPassword(generatePassword())}
          className="text-xs border rounded px-2 py-1"
        >
          Generate
        </button>
      </div>
      <p className="text-xs text-gray-500">
        At least 8 characters. Nothing is emailed — share it with them directly.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="self-start text-sm font-medium text-white bg-[var(--color-secondary)] border-2 border-[var(--color-primary)] rounded px-3 py-2 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Set password"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
