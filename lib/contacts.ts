import "server-only";
import { createClient } from "@/lib/supabase/server";

// Who to ask (0109): the board with titles, club jobs (treasurer, apparel,
// food tent), committees and coaches, for the contacts page, the home card
// and the roster badges. Read as the signed-in member, so it's their club.

export type Contact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
};

export type ClubContacts = {
  board: Contact[];
  jobs: { label: string; people: Contact[] }[];
  committees: { id: string; name: string; members: (Contact & { is_chair: boolean })[] }[];
  coaches: Contact[];
};

// Show the usual officers first, then everyone else by name.
const TITLE_ORDER = ["president", "vice president", "secretary", "treasurer"];

function titleRank(title: string | null) {
  const i = TITLE_ORDER.indexOf((title ?? "").trim().toLowerCase());
  return i === -1 ? TITLE_ORDER.length : i;
}

export const CONTACTS_CARD_KEY = "contacts_card";

type Row = {
  id: string;
  display_name: string;
  club_title: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  role: string;
  is_board_member: boolean;
  is_treasurer: boolean;
  is_apparel_chair: boolean;
  is_tent_leader: boolean;
};

export async function getClubContacts(): Promise<ClubContacts> {
  const supabase = await createClient();
  const [{ data: peopleData }, { data: committeeData }, { data: memberData }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, club_title, email, phone, photo_url, role, is_board_member, is_treasurer, is_apparel_chair, is_tent_leader"
      )
      .not("approved_at", "is", null)
      .is("disabled_at", null)
      .order("display_name"),
    supabase.from("committees").select("id, name, sort_order").order("sort_order").order("name"),
    supabase.from("committee_members").select("committee_id, profile_id, is_chair"),
  ]);
  const people = (peopleData as Row[] | null) ?? [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const contact = (p: Row): Contact => ({
    id: p.id,
    name: p.display_name,
    title: p.club_title,
    email: p.email,
    phone: p.phone,
    photo_url: p.photo_url,
  });

  const board = people
    .filter((p) => p.is_board_member)
    .sort((a, b) => titleRank(a.club_title) - titleRank(b.club_title) || a.display_name.localeCompare(b.display_name))
    .map(contact);

  const jobs = [
    { label: "Treasurer", people: people.filter((p) => p.is_treasurer).map(contact) },
    { label: "Apparel", people: people.filter((p) => p.is_apparel_chair).map(contact) },
    { label: "Food tent", people: people.filter((p) => p.is_tent_leader).map(contact) },
  ].filter((j) => j.people.length > 0);

  const members = (memberData as { committee_id: string; profile_id: string; is_chair: boolean }[] | null) ?? [];
  const committees = ((committeeData as { id: string; name: string }[] | null) ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    members: members
      .filter((m) => m.committee_id === c.id && byId.has(m.profile_id))
      .map((m) => ({ ...contact(byId.get(m.profile_id)!), is_chair: m.is_chair }))
      .sort((a, b) => Number(b.is_chair) - Number(a.is_chair) || a.name.localeCompare(b.name)),
  }));

  const coaches = people.filter((p) => p.role === "coach").map(contact);

  return { board, jobs, committees, coaches };
}

// Short labels for someone's club jobs, for roster badges: their title (or
// "Board"), Treasurer, Apparel, Food tent, and committees they chair or sit on.
export function badgesFor(
  p: { id: string; club_title?: string | null; is_board_member?: boolean; is_treasurer?: boolean; is_apparel_chair?: boolean; is_tent_leader?: boolean },
  committees: ClubContacts["committees"]
): string[] {
  const badges: string[] = [];
  if (p.is_board_member) badges.push(p.club_title ? `Board · ${p.club_title}` : "Board");
  else if (p.club_title) badges.push(p.club_title);
  if (p.is_treasurer && !(p.club_title ?? "").toLowerCase().includes("treasurer")) badges.push("Treasurer");
  if (p.is_apparel_chair) badges.push("Apparel");
  if (p.is_tent_leader) badges.push("Food tent");
  for (const c of committees) {
    const m = c.members.find((x) => x.id === p.id);
    if (m) badges.push(m.is_chair ? `${c.name} chair` : c.name);
  }
  return badges;
}
