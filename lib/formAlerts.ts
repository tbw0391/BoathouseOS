import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeMemberIds, familyMemberIds, sendPush } from "@/lib/push";
import { formatClosing } from "@/lib/forms";
import type { Form, FormAudience } from "@/lib/database.types";

// Who a form or election is for (matches can_see_form() in 0115).
export async function formAudienceIds(clubId: string, audience: FormAudience): Promise<string[]> {
  switch (audience) {
    case "rowers":
      return activeMemberIds(clubId, ["rower", "coxswain"]);
    case "parents":
      return familyMemberIds(clubId);
    case "coaches":
      return activeMemberIds(clubId, ["coach", "admin"]);
    case "board": {
      const { data } = await createAdminClient()
        .from("profiles")
        .select("id")
        .eq("club_id", clubId)
        .or("role.eq.admin,is_board_member.eq.true")
        .not("approved_at", "is", null)
        .is("disabled_at", null);
      return ((data as { id: string }[] | null) ?? []).map((p) => p.id);
    }
    default:
      return activeMemberIds(clubId);
  }
}

type Admin = ReturnType<typeof createAdminClient>;

// Everyone in a member's household for "one vote per family", like
// household_ids() in 0115: them and their spouse, the rowers either of them
// is a guardian of (or themselves, if they're such a rower), and those
// rowers' guardians and their spouses.
export function householdOf(
  person: string,
  links: { guardian_id: string; rower_id: string }[],
  spouseOf: Map<string, string>
): Set<string> {
  const spouses = (ids: Iterable<string>) => {
    const out = new Set<string>();
    for (const id of ids) {
      out.add(id);
      const s = spouseOf.get(id);
      if (s) out.add(s);
    }
    return out;
  };
  const base = spouses([person]);
  const kids = new Set(links.filter((l) => base.has(l.guardian_id)).map((l) => l.rower_id));
  if (links.some((l) => l.rower_id === person)) kids.add(person);
  const adults = new Set([...base, ...links.filter((l) => kids.has(l.rower_id)).map((l) => l.guardian_id)]);
  return new Set([...spouses(adults), ...kids]);
}

// Who a form or election is for and still hasn't answered or voted. For an
// election, people who can't vote are left out: under-18 rowers and coxes
// in an adults-only one, and families that already used their vote.
export async function formPending(
  admin: Admin,
  form: Pick<Form, "id" | "club_id" | "kind" | "audience" | "voters">
): Promise<{ audience: string[]; pending: string[] }> {
  const audience = await formAudienceIds(form.club_id, form.audience);
  const election = form.kind === "election";
  const { data: doneRows } = election
    ? await admin.from("election_voters").select("voter_id").eq("form_id", form.id)
    : await admin.from("form_responses").select("respondent_id").eq("form_id", form.id);
  const done = new Set(
    ((doneRows as Record<string, string>[] | null) ?? []).map((r) => (election ? r.voter_id : r.respondent_id))
  );
  let pending = audience.filter((id) => !done.has(id));

  if (election && form.voters === "adults" && pending.length) {
    const { data } = await admin.from("profiles").select("id, role, birthday").in("id", pending);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    const minors = new Set(
      ((data as { id: string; role: string; birthday: string | null }[] | null) ?? [])
        .filter((p) => (p.role === "rower" || p.role === "coxswain") && (!p.birthday || p.birthday > cutoffDay))
        .map((p) => p.id)
    );
    pending = pending.filter((id) => !minors.has(id));
  }

  if (election && form.voters === "family" && pending.length && done.size) {
    const [{ data: linkRows }, { data: spouseRows }] = await Promise.all([
      admin.from("family_links").select("guardian_id, rower_id").eq("club_id", form.club_id),
      admin.from("profiles").select("id, spouse_id").eq("club_id", form.club_id).not("spouse_id", "is", null),
    ]);
    const links = (linkRows as { guardian_id: string; rower_id: string }[] | null) ?? [];
    const spouseOf = new Map<string, string>();
    for (const p of (spouseRows as { id: string; spouse_id: string }[] | null) ?? []) {
      spouseOf.set(p.id, p.spouse_id);
      spouseOf.set(p.spouse_id, p.id);
    }
    pending = pending.filter((id) => ![...householdOf(id, links, spouseOf)].some((h) => done.has(h)));
  }

  return { audience, pending };
}

export async function sendFormReminder(
  form: Pick<Form, "id" | "kind" | "title" | "closes_at">,
  pending: string[],
  closingSoon: boolean
) {
  const election = form.kind === "election";
  const when = form.closes_at ? ` It closes ${formatClosing(form.closes_at)}.` : "";
  await sendPush(pending, {
    kind: "form_reminder",
    title: election ? `Reminder to vote: ${form.title}` : `Reminder: ${form.title}`,
    body: closingSoon
      ? `${election ? "Voting closes" : "It closes"} soon and you haven't ${election ? "voted" : "filled it in"} yet.${when}`
      : `You haven't ${election ? "voted" : "filled it in"} yet.${when}`,
    url: `/forms/${form.id}`,
    tag: `form-reminder-${form.id}`,
  });
}
