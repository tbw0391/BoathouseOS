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
  approved_at: string | null;
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
  is_treasurer: boolean;
  us_rowing_number: string | null;
  spouse_id: string | null;
  walk_up_song: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  // Email important alerts when phone alerts are off (0092).
  email_alerts: boolean;
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
  // Regatta logo, shown inside the medal badges on rowers' bios.
  artwork_url: string | null;
  // Race course, set on the regatta's Course tab (0082).
  start_lat: number | null;
  start_lng: number | null;
  finish_lat: number | null;
  finish_lng: number | null;
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
  place: number | null;
  created_by: string | null;
  created_at: string;
  chat_group_id: string | null;
  // lib/demoClubs.ts slug of the club this lineup is for; null = any club.
  club_slug: string | null;
  // From the heat sheet (0083).
  bow_number: string | null;
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
  // lib/demoClubs.ts slug of the club this race is for; null = any club.
  club_slug: string | null;
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

export interface TaskType {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface CoachTask {
  id: string;
  event_id: string;
  task_type_id: string;
  lineup_id: string | null;
  race_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CoachTaskAssignment {
  task_id: string;
  user_id: string;
  assigned_at: string;
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
  is_board: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ErgTime {
  id: string;
  profile_id: string;
  distance: "2k" | "5k";
  time_text: string;
  seconds: number;
  previous_best_seconds: number | null;
  is_pr: boolean;
  recorded_at: string;
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

export interface PhotoLike {
  photo_id: string;
  profile_id: string;
  created_at: string;
}

export interface PhotoComment {
  id: string;
  photo_id: string;
  author_id: string;
  body: string;
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

export interface CoachCheckIn {
  id: string;
  profile_id: string;
  checked_in_at: string;
}

export type AttendanceStatus = 'checked_in' | 'absent';

export interface PracticeAttendance {
  profile_id: string;
  practice_date: string;
  status: AttendanceStatus;
  reason: string | null;
  responded_at: string;
}

export interface OnWaterSession {
  id: string;
  lineup_id: string | null;
  boat_id: string | null;
  // Map color, picked by the database so no two boats on the water match.
  color: string | null;
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

// Payments (0067_payments.sql). Money is integer cents.
export type FeeMode = "club" | "payer";

export interface PaymentSettings {
  id: boolean;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  default_fee_mode: FeeMode;
  updated_at: string;
}

export interface Charge {
  id: string;
  title: string;
  description: string | null;
  kind: "season" | "dues" | "regatta" | "travel" | "apparel" | "other";
  amount_cents: number;
  due_date: string | null;
  fee_mode: FeeMode | null;
  event_id: string | null;
  signup_open: boolean;
  allow_installments: boolean;
  installment_count: number;
  installment_interval_days: number;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface Discount {
  id: string;
  name: string;
  kind: "percent" | "amount";
  percent_bps: number | null;
  amount_cents: number | null;
  charge_id: string | null;
  profile_id: string | null;
  expires_on: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  charge_id: string;
  rower_id: string;
  amount_cents: number;
  discount_cents: number;
  discount_note: string | null;
  plan: "full" | "installments";
  status: "owed" | "paid" | "waived" | "cancelled";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  signed_up_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  bill_id: string | null;
  order_id: string | null;
  amount_cents: number;
  surcharge_cents: number;
  platform_fee_cents: number;
  method: "card" | "cash" | "check" | "other";
  status: "pending" | "succeeded" | "failed" | "refunded";
  installment_number: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  note: string | null;
  paid_by: string | null;
  recorded_by: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  sizes: string[];
  in_stock_item: boolean;
  active: boolean;
  created_at: string;
}

export interface ProductStock {
  product_id: string;
  size: string;
  quantity: number;
}

export interface OrderWindow {
  id: string;
  title: string;
  description: string | null;
  opens_at: string;
  closes_at: string;
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  for_rower_id: string | null;
  window_id: string | null;
  status: "pending" | "paid" | "picked_up" | "cancelled";
  total_cents: number;
  created_at: string;
  paid_at: string | null;
  picked_up_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  size: string;
  quantity: number;
  price_cents: number;
}

export interface TrailerItem {
  id: string;
  event_id: string;
  label: string;
  kind: "boat" | "oars" | "rigging" | "electronics" | "other";
  boat_id: string | null;
  sort: number;
  packed_out_at: string | null;
  packed_out_by: string | null;
  packed_home_at: string | null;
  packed_home_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RegattaTravel {
  event_id: string;
  depart_at: string | null;
  depart_from: string | null;
  return_at: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  notes: string | null;
  updated_at: string;
}

export interface TravelVehicle {
  id: string;
  event_id: string;
  label: string;
  driver_id: string | null;
  seats: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TravelRider {
  vehicle_id: string;
  event_id: string;
  profile_id: string;
  added_by: string | null;
}

export interface TravelRoom {
  id: string;
  event_id: string;
  label: string;
  capacity: number;
  created_at: string;
}

export interface TravelRoomMember {
  room_id: string;
  event_id: string;
  profile_id: string;
}

export interface EmergencyInfo {
  profile_id: string;
  contact1_name: string | null;
  contact1_relation: string | null;
  contact1_phone: string | null;
  contact2_name: string | null;
  contact2_relation: string | null;
  contact2_phone: string | null;
  allergies: string | null;
  medications: string | null;
  medical_notes: string | null;
  updated_at: string;
  updated_by: string | null;
}
