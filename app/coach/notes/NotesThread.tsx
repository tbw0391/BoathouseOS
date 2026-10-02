"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CoachNote } from "@/lib/database.types";
import { unwrap } from "@/lib/userError";
import { addCoachNote, deleteCoachNote } from "./actions";

// One list of coach notes (an athlete's, or a practice day's), newest last,
// kept live so every coach sees a note the moment another adds it.
export function NotesThread({
  initialNotes,
  athleteId,
  noteDate,
  authorNames,
  currentUserId,
  isAdmin,
  placeholder,
}: {
  initialNotes: CoachNote[];
  athleteId: string | null;
  noteDate: string | null;
  authorNames: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  placeholder: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  useEffect(() => setNotes(initialNotes), [initialNotes]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const filter = athleteId ? `athlete_id=eq.${athleteId}` : `note_date=eq.${noteDate}`;
    const channel = supabase
      .channel(`coach-notes-${athleteId ?? noteDate}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "coach_notes", filter }, (payload) => {
        const note = payload.new as CoachNote;
        // A practice day's thread holds only the day's general notes.
        if (!athleteId && note.athlete_id) return;
        setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "coach_notes" }, (payload) => {
        const gone = (payload.old as { id?: string }).id;
        if (gone) setNotes((prev) => prev.filter((n) => n.id !== gone));
      });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel.subscribe();
    });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [athleteId, noteDate]);

  async function handleAdd() {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const note = unwrap(await addCoachNote({ athleteId, noteDate, body: draft })) as CoachNote;
      setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that note.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setConfirmingDelete(null);
    setError(null);
    try {
      unwrap(await deleteCoachNote(id));
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that note.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border-2 border-gray-200 px-3 py-2">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <span>
                  {(n.created_by && authorNames[n.created_by]) || "A coach"} ·{" "}
                  {new Date(n.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/New_York",
                  })}
                </span>
                {(n.created_by === currentUserId || isAdmin) &&
                  (confirmingDelete === n.id ? (
                    <>
                      <button onClick={() => handleDelete(n.id)} className="font-semibold text-red-700 underline">
                        Yes, delete
                      </button>
                      <button onClick={() => setConfirmingDelete(null)} className="underline">
                        Keep
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmingDelete(n.id)} className="underline">
                      Delete
                    </button>
                  ))}
              </p>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={4000}
        className="border rounded px-3 py-2"
      />
      <button
        onClick={handleAdd}
        disabled={saving || !draft.trim()}
        className="self-start bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
      >
        {saving ? "Saving..." : "Add note"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
