// Row types for the ORBIT database.
// `supabase.ts` is generated from the schema — run `npm run db:types` after changing migrations.
import type { Tables } from "./supabase";

export type { Database, Tables, TablesInsert, TablesUpdate } from "./supabase";

export type Profile = Tables<"profiles">;
export type Organiser = Tables<"organisers">;
export type OrganiserMember = Tables<"organiser_members">;
export type Category = Tables<"categories">;
export type OrbitEvent = Tables<"events">;
export type EventPrivate = Tables<"event_private">;
export type TicketType = Tables<"ticket_types">;
export type EventQuestion = Tables<"event_questions">;
export type Registration = Tables<"registrations">;
export type UserEvent = Tables<"user_events">;
export type Follow = Tables<"follows">;
export type EventInteraction = Tables<"event_interactions">;

export type UserRole = "user" | "admin" | "super_admin";
export type EventFormat = "in_person" | "online" | "hybrid";
export type EventStatus = "draft" | "published" | "cancelled" | "expired" | "removed";
export type RegistrationMode = "tickets" | "external" | "none";
export type RegistrationStatus =
  | "going"
  | "pending"
  | "waitlisted"
  | "awaiting_payment"
  | "declined"
  | "cancelled";
export type PaymentStatus = "none" | "pending" | "paid" | "refunded" | "failed";
export type OrganiserStatus = "pending" | "approved" | "rejected" | "suspended";
export type OrganiserKind = "society" | "university" | "employer" | "community" | "other";
export type UserEventKind = "saved" | "dismissed" | "external_registered" | "attended";
export type QuestionKind = "short_text" | "long_text" | "single_select" | "multi_select" | "checkbox";
export type CategoryGroup = "career" | "social" | "other";
export type InteractionKind = "view" | "apply_click" | "share" | "calendar_add";
