import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { CONTACTS_CARD_KEY, getClubContacts, type Contact } from "@/lib/contacts";
import {
  addCommitteeMember,
  createCommittee,
  deleteCommittee,
  renameCommittee,
  setClubTitle,
  setContactsCard,
  setJob,
  updateCommitteeMember,
} from "./actions";

const TITLES = ["President", "Vice President", "Secretary", "Treasurer", "Member at large", "Head coach", "Assistant coach"];
const JOBS = [
  { job: "treasurer", label: "Treasurer", detail: "Runs Payments." },
  { job: "apparel", label: "Apparel", detail: "Manages apparel and orders." },
  { job: "tent", label: "Food tent", detail: "Runs the food tent lists." },
] as const;

const input = "border rounded px-3 py-2 text-sm";
const button =
  "bg-[var(--color-primary)] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors";
const small = "text-xs border rounded px-2 py-1";

// Admin Settings > Board and committees: who's on the board and their
// titles, club jobs, committees, coaches' titles, and the home card (0109).
export default async function AdminContactsPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_club_admin");
  if (!isAdmin) notFound();

  const [{ board, jobs, committees, coaches }, { data: peopleData }, { data: cardRow }] = await Promise.all([
    getClubContacts(),
    supabase.from("profiles").select("id, display_name").not("approved_at", "is", null).is("disabled_at", null).order("display_name"),
    supabase.from("club_settings").select("value").eq("key", CONTACTS_CARD_KEY).maybeSingle(),
  ]);
  const people = (peopleData as { id: string; display_name: string }[] | null) ?? [];
  const showCard = (cardRow as { value: string | null } | null)?.value !== "off";
  const boardIds = new Set(board.map((b) => b.id));

  const PersonPicker = ({ name = "id", exclude = new Set<string>() }: { name?: string; exclude?: Set<string> }) => (
    <select name={name} required defaultValue="" className={`${input} flex-1 min-w-0`}>
      <option value="" disabled>
        Pick someone…
      </option>
      {people
        .filter((p) => !exclude.has(p.id))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
    </select>
  );

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto flex flex-col gap-8">
      <datalist id="titles">
        {TITLES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← Admin Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Board and committees</h1>
        <p className="text-sm text-gray-500">
          Shown on the Who to Ask page, as badges on the Roster, and on the home card.{" "}
          <Link href="/contacts" className="text-[var(--color-primary)] hover:underline">
            See Who to Ask →
          </Link>
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Board</h2>
        {board.length === 0 && <p className="text-sm text-gray-500">No board members yet.</p>}
        {board.map((p) => (
          <div key={p.id} className="border rounded-lg px-3 py-2 flex flex-col gap-2">
            <span className="font-medium text-sm">{p.name}</span>
            <div className="flex gap-2 items-start">
              <TitleForm person={p} />
              <ActionForm action={setJob}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="job" value="board" />
                <input type="hidden" name="on" value="0" />
                <button type="submit" className={`${small} text-red-700`}>
                  Remove
                </button>
              </ActionForm>
            </div>
          </div>
        ))}
        <ActionForm action={setJob} className="flex flex-wrap gap-2 border rounded-lg p-3">
          <input type="hidden" name="job" value="board" />
          <input type="hidden" name="on" value="1" />
          <PersonPicker exclude={boardIds} />
          <input name="title" list="titles" placeholder="Title (e.g. President)" className={`${input} w-40`} />
          <button type="submit" className={button}>
            Add to board
          </button>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Club jobs</h2>
        <p className="text-xs text-gray-500 -mt-2">These also turn on the matching tools (Payments, Manage Apparel, food tent).</p>
        {JOBS.map(({ job, label, detail }) => {
          const holders = jobs.find((j) => j.label === label)?.people ?? [];
          return (
            <div key={job} className="border rounded-lg p-3 flex flex-col gap-2 text-sm">
              <span>
                <span className="font-medium">{label}</span> <span className="text-xs text-gray-500">{detail}</span>
              </span>
              {holders.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span>{p.name}</span>
                  <ActionForm action={setJob}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="job" value={job} />
                    <input type="hidden" name="on" value="0" />
                    <button type="submit" className={`${small} text-red-700`}>
                      Remove
                    </button>
                  </ActionForm>
                </div>
              ))}
              <ActionForm action={setJob} className="flex gap-2">
                <input type="hidden" name="job" value={job} />
                <input type="hidden" name="on" value="1" />
                <PersonPicker exclude={new Set(holders.map((h) => h.id))} />
                <button type="submit" className={button}>
                  Add
                </button>
              </ActionForm>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Committees</h2>
        {committees.map((c) => (
          <div key={c.id} className="border rounded-lg p-3 flex flex-col gap-2 text-sm">
            <div className="flex gap-2 items-start">
              <ActionForm action={renameCommittee} className="flex gap-2 flex-1">
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} required className={`${input} flex-1 min-w-0 font-medium`} />
                <button type="submit" className={small}>
                  Rename
                </button>
              </ActionForm>
              <ActionForm action={deleteCommittee}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className={`${small} text-red-700`}>
                  Delete
                </button>
              </ActionForm>
            </div>
            {c.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <span>
                  {m.name}
                  {m.is_chair && <span className="text-xs text-gray-500"> · chair</span>}
                </span>
                <span className="flex gap-1">
                  <ActionForm action={updateCommitteeMember}>
                    <input type="hidden" name="committee_id" value={c.id} />
                    <input type="hidden" name="profile_id" value={m.id} />
                    <input type="hidden" name="change" value={m.is_chair ? "member" : "chair"} />
                    <button type="submit" className={small}>
                      {m.is_chair ? "Not chair" : "Make chair"}
                    </button>
                  </ActionForm>
                  <ActionForm action={updateCommitteeMember}>
                    <input type="hidden" name="committee_id" value={c.id} />
                    <input type="hidden" name="profile_id" value={m.id} />
                    <input type="hidden" name="change" value="remove" />
                    <button type="submit" className={`${small} text-red-700`}>
                      Remove
                    </button>
                  </ActionForm>
                </span>
              </div>
            ))}
            <ActionForm action={addCommitteeMember} className="flex flex-wrap gap-2 items-center">
              <input type="hidden" name="committee_id" value={c.id} />
              <PersonPicker name="profile_id" exclude={new Set(c.members.map((m) => m.id))} />
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" name="is_chair" /> Chair
              </label>
              <button type="submit" className={button}>
                Add
              </button>
            </ActionForm>
          </div>
        ))}
        <ActionForm action={createCommittee} className="flex gap-2">
          <input name="name" required placeholder="New committee, e.g. Fundraising" className={`${input} flex-1 min-w-0`} />
          <button type="submit" className={button}>
            Add committee
          </button>
        </ActionForm>
      </section>

      {coaches.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Coaches&apos; titles</h2>
          {coaches.map((p) => (
            <div key={p.id} className="border rounded-lg px-3 py-2 flex flex-col gap-2">
              <span className="font-medium text-sm">{p.name}</span>
              <TitleForm person={p} />
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Home page card</h2>
        <ActionForm action={setContactsCard} className="flex flex-col gap-2">
          <label className="border rounded-lg px-3 py-2 text-sm flex items-start gap-2">
            <input type="checkbox" name="show" defaultChecked={showCard} className="w-4 h-4 mt-0.5" />
            <span>
              <span className="font-medium">Show &quot;Questions?&quot; on the home page</span>
              <span className="block text-xs text-gray-500">The board&apos;s officers and club jobs, with a link to Who to Ask.</span>
            </span>
          </label>
          <button type="submit" className={`${button} self-start`}>
            Save
          </button>
        </ActionForm>
      </section>
    </div>
  );
}

function TitleForm({ person }: { person: Contact }) {
  return (
    <ActionForm action={setClubTitle} className="flex gap-2 flex-1">
      <input type="hidden" name="id" value={person.id} />
      <input name="title" list="titles" defaultValue={person.title ?? ""} placeholder="Title" className={`${input} flex-1 min-w-0`} />
      <button type="submit" className={small}>
        Save
      </button>
    </ActionForm>
  );
}
