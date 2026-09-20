"use client";

import { useRef, useState, useTransition } from "react";
import { addMember } from "./actions";
import { TEAM_LABELS, TEAM_OPTIONS } from "@/lib/teams";

export function AddMemberForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setInviteLink(null);
    setJustAdded(false);
    startTransition(async () => {
      try {
        const result = await addMember(formData);
        formRef.current?.reset();
        setInviteLink(result?.inviteLink ?? null);
        setJustAdded(true);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          onClick={() => setOpen(true)}
          className="rounded bg-black text-white text-sm px-3 py-2"
        >
          Add member
        </button>
        {inviteLink && (
          <div className="text-sm border rounded p-3 max-w-md break-all">
            <p className="font-medium mb-1">Member added. Send them this invite link:</p>
            <a href={inviteLink} className="text-blue-600 underline">
              {inviteLink}
            </a>
          </div>
        )}
        {justAdded && !inviteLink && (
          <p className="text-sm text-green-700">Member added to the roster.</p>
        )}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="mt-4 border rounded-lg p-4 flex flex-col gap-3 max-w-md"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Add member</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>

      <input
        name="first_name"
        placeholder="First name"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        name="last_name"
        placeholder="Last name"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <select name="role" defaultValue="rower" className="border rounded px-3 py-2 text-sm">
        <option value="rower">Rower</option>
        <option value="coxswain">Coxswain</option>
        <option value="coach">Coach</option>
        <option value="parent">Parent</option>
        <option value="admin">Admin</option>
      </select>
      <select name="boat_side" defaultValue="" className="border rounded px-3 py-2 text-sm">
        <option value="">No preference</option>
        <option value="port">Port</option>
        <option value="starboard">Starboard</option>
        <option value="either">Either</option>
      </select>
      <select name="team" defaultValue="" className="border rounded px-3 py-2 text-sm">
        <option value="">No group</option>
        {TEAM_OPTIONS.map((team) => (
          <option key={team} value={team}>
            {TEAM_LABELS[team]}
          </option>
        ))}
      </select>
      <input
        name="phone"
        placeholder="Phone (optional)"
        className="border rounded px-3 py-2 text-sm"
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="create_login" defaultChecked />
        Create a login for them (sends an invite link to share)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-black text-white rounded px-3 py-2 text-sm disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add member"}
      </button>
    </form>
  );
}
