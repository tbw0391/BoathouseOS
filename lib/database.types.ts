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
  erg_2k_time: string | null;
  erg_5k_time: string | null;
  is_board_member: boolean;
  is_tent_leader: boolean;
  us_rowing_number: string | null;
  spouse_id: string | null;
  walk_up_song: string | null;
}

export interface ProfileTeam {
  profile_id: string;
  team: Team;
}

export interface FamilyLink {
  guardian_id: string;
  rower_id: string;
  created_at: string;
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

export interface EventForecast {
  event_id: string;
  geocoded_location: string | null;
  latitude: number | null;
  longitude: number | null;
  forecast_date: string | null;
  high_f: number | null;
  low_f: number | null;
  short_forecast: string | null;
  precipitation_chance: number | null;
  wind: string | null;
  icon_url: string | null;
  fetched_at: string;
  created_at: string;
}

export interface ScheduleView {
  user_id: string;
  last_viewed_at: string;
}

export type RsvpStatus = 'pending' | 'attending' | 'not_attending';

export interface EventRsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  responded_at: string;
}

// Generated at runtime from LINEUP_CATEGORY_OPTIONS in lib/lineupCategories.ts
// (gender x depth 1-4 x team boat class, plus masters/development) — too
// large a set to hand-maintain as a literal union; validity is enforced by
// that list at the app layer and by a check constraint in the database.
export type LineupCategory = string;

export interface Lineup {
  id: string;
  event_id: string | null;
  boat_id: string | null;
  boat_name: string;
  boat_class: string;
  category: LineupCategory | null;
  notes: string | null;
  race_time: string | null;
  race_name: string | null;
  created_by: string | null;
  created_at: string;
  chat_group_id: string | null;
}

export interface Boat {
  id: string;
  name: string;
  boat_class: string;
  category: LineupCategory | null;
  notes: string | null;
  hull_color: string | null;
  rig: string | null;
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

export interface Race {
  id: string;
  event_id: string;
  category: LineupCategory | null;
  race_name: string;
  race_time: string | null;
  lineup_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LineupTemplate {
  id: string;
  name: string;
  boat_class: string;
  boat_id: string | null;
  category: LineupCategory | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LineupTemplateSeat {
  id: string;
  template_id: string;
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
  team: Team | null;
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

export interface FoodTentItem {
  id: string;
  event_id: string;
  title: string;
  quantity_needed: number;
  notes: string | null;
  published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface FoodTentSignup {
  item_id: string;
  user_id: string;
  quantity: number;
  signed_up_at: string;
}

export type FoodTentPublishStatus = 'draft' | 'pending_confirmation' | 'published';

export interface FoodTentStatus {
  event_id: string;
  status: FoodTentPublishStatus;
  draft_generated_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  published_at: string | null;
  created_at: string;
}

export interface FoodTentWishlistItem {
  id: string;
  title: string;
  quantity_needed: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FoodTentWishlistSignup {
  item_id: string;
  user_id: string;
  quantity: number;
  signed_up_at: string;
}

export interface Poll {
  id: string;
  question: string;
  allow_multiple: boolean;
  board_only: boolean;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface PollInvitee {
  poll_id: string;
  user_id: string;
  added_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  created_at: string;
}

export interface PollVote {
  poll_id: string;
  option_id: string;
  user_id: string;
  voted_at: string;
}

export interface Photo {
  id: string;
  url: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PhotoTag {
  photo_id: string;
  profile_id: string;
  tagged_by: string | null;
  created_at: string;
}

export type SuggestionStatus = 'new' | 'reviewed';
export type SuggestionCategory = 'club' | 'app';

export interface Suggestion {
  id: string;
  submitted_by: string | null;
  body: string;
  status: SuggestionStatus;
  category: SuggestionCategory;
  created_at: string;
}

export type AnnouncementAudience = 'rowers' | 'parents' | 'both';

export interface CoachAnnouncement {
  id: string;
  sender_id: string | null;
  audience: AnnouncementAudience;
  message: string;
  created_at: string;
}

export interface OnWaterSession {
  id: string;
  lineup_id: string | null;
  coxswain_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface LocationPing {
  id: string;
  session_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  heading_deg: number | null;
  speed_mps: number | null;
  recorded_at: string;
}

export type MaintenanceType = 'boat' | 'site';
export type MaintenanceStatus = 'open' | 'resolved';

export interface MaintenanceRequest {
  id: string;
  type: MaintenanceType;
  boat_id: string | null;
  description: string;
  status: MaintenanceStatus;
  submitted_by: string | null;
  created_at: string;
  resolved_at: string | null;
}
