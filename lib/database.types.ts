// Hand-written types matching supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is live if you'd
// rather have the CLI keep this in sync automatically.

export type Role = 'rower' | 'coach' | 'coxswain' | 'parent' | 'admin';
export type BoatSide = 'port' | 'starboard' | 'either';
export type Team = 'mens' | 'womens' | 'development' | 'masters' | 'alumni' | 'coach' | 'parent';

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  phone: string | null;
  boat_side: BoatSide | null;
  weight_lbs: number | null;
  disabled_at: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  high_school: string | null;
  grad_year: number | null;
  fun_fact: string | null;
  photo_url: string | null;
  birthday: string | null;
  team: Team | null;
}

export type EventType = 'practice' | 'regatta' | 'meeting' | 'other';
export type ScheduleRecurrence = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string | null;
  recurrence: ScheduleRecurrence;
  created_by: string | null;
  created_at: string;
}

export type RsvpStatus = 'pending' | 'attending' | 'not_attending';

export interface EventRsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  responded_at: string;
}

export interface Lineup {
  id: string;
  event_id: string | null;
  boat_name: string;
  boat_class: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type SeatRole = 'rower' | 'coxswain' | 'coach';

export interface LineupSeat {
  id: string;
  lineup_id: string;
  seat_number: number;
  seat_role: SeatRole;
  rower_id: string | null;
}

export interface VolunteerNeed {
  id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  slots_needed: number;
  created_by: string | null;
  created_at: string;
}

export interface VolunteerSignup {
  need_id: string;
  user_id: string;
  signed_up_at: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  is_direct: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChatGroupMember {
  group_id: string;
  user_id: string;
  last_read_at: string;
}

export interface Message {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ClubSetting {
  key: string;
  value: string | null;
}
