"use client";

import { useRef, useState, useTransition } from "react";
import { createClub } from "../actions";
import { unwrap } from "@/lib/userError";

export function CreateClubForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ clubName: string; email: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setMade(null);
    startTransition(async () => {
      try {
        setMade(unwrap(await createClub(formData)));
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="border rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Add a club</h2>
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2">
        <input name="name" placeholder="Club name" required className="border rounded px-3 py-2" />
        <p className="text-sm text-gray-500">Its first admin:</p>
        <div className="flex gap-2">
          <input name="first_name" placeholder="First name" required className="border rounded px-3 py-2 flex-1 min-w-0" />
          <input name="last_name" placeholder="Last name" required className="border rounded px-3 py-2 flex-1 min-w-0" />
        </div>
        <input name="email" type="email" placeholder="Email" required className="border rounded px-3 py-2" />
        <button
          type="submit"
          disabled={isPending}
          className="bg-[var(--color-primary)] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add club"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      {made && <PasswordNote heading={`${made.clubName} is set up.`} email={made.email} password={made.password} />}
    </section>
  );
}

export function PasswordNote({ heading, email, password }: { heading: string; email: string; password: string }) {
  return (
    <div className="border-2 border-green-600 rounded-lg p-3 text-sm flex flex-col gap-1">
      <p className="font-medium">{heading}</p>
      <p>Send the admin these to sign in (they won&apos;t be shown again):</p>
      <p>
        Email: <span className="font-mono">{email}</span>
      </p>
      <p>
        Temporary password: <span className="font-mono select-all">{password}</span>
      </p>
      <p className="text-xs text-gray-500">
        They sign in at boathouseos.app/login, then pick their own password at boathouseos.app/reset-password.
      </p>
    </div>
  );
}
