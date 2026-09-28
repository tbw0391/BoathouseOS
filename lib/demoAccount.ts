import type { Role, Team } from "@/lib/database.types";

// Shared accounts everyone lands in from the "Try the demo" button, so
// visiting clubs can look around without signing up. There's one per type
// of user (picked on /choose-profile) so visitors can see what each one
// gets; the admin one sees every screen. Only safe because this project's
// database holds demo data only — never point this build at a real club's
// Supabase project.
export const DEMO_EMAIL = "demo@boathouseos.app";

export type DemoProfile = {
  role: Role;
  label: string;
  blurb: string;
  email: string;
  team: Team | null;
};

export const DEMO_PROFILES: DemoProfile[] = [
  {
    role: "admin",
    label: "Admin",
    blurb: "Everything, plus club settings and who sees which buttons.",
    email: DEMO_EMAIL,
    team: null,
  },
  {
    role: "coach",
    label: "Coach",
    blurb: "Lineups, practice attendance, tasks and the live boat map.",
    email: "demo-coach@boathouseos.app",
    team: "coach",
  },
  {
    role: "rower",
    label: "Rower",
    blurb: "Practice check-in, their lineups, races and bio.",
    email: "demo-rower@boathouseos.app",
    team: "mens",
  },
  {
    role: "coxswain",
    label: "Coxswain",
    blurb: "Everything a rower sees, plus tracking their boat on the water.",
    email: "demo-coxswain@boathouseos.app",
    team: "womens",
  },
  {
    role: "parent",
    label: "Parent",
    blurb: "Their rower's schedule and races, payments and volunteering.",
    email: "demo-parent@boathouseos.app",
    team: "parent",
  },
];

export function findDemoProfile(role: string | null | undefined): DemoProfile | null {
  return DEMO_PROFILES.find((p) => p.role === role) ?? null;
}

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && DEMO_PROFILES.some((p) => p.email === email);
}
