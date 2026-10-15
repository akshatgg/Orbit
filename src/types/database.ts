// Hand-written to match supabase/migrations. Once the Supabase project exists,
// replace with generated types: npx supabase gen types typescript --project-id <ref>

export type EventFormat = "in_person" | "online" | "hybrid";
export type EventStatus = "scheduled" | "cancelled" | "expired" | "unverified";
export type EventAvailability = "available" | "limited" | "full" | "unknown";
export type UserEventStatus = "saved" | "registered" | "attended" | "dismissed";
export type CategoryGroup = "career" | "social" | "other";

export interface Profile {
  id: string;
  full_name: string | null;
  university: string | null;
  department: string | null;
  course: string | null;
  year_of_study: string | null;
  career_interests: string[];
  personal_interests: string[];
  preferred_event_types: string[];
  preferred_formats: EventFormat[];
  location_preference: string | null;
  availability: Record<string, string[]> | null;
  is_verified_student: boolean;
  role: "student" | "admin";
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  group: CategoryGroup;
}

export interface OrbitEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  format: EventFormat;
  venue: string | null;
  online_url: string | null;
  organiser: string | null;
  category_id: string | null;
  tags: string[];
  price_min: number | null;
  price_max: number | null;
  currency: string;
  registration_deadline: string | null;
  registration_url: string | null;
  availability: EventAvailability;
  status: EventStatus;
  source: string;
  source_url: string | null;
  source_event_id: string | null;
  last_verified_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserEvent {
  user_id: string;
  event_id: string;
  status: UserEventStatus;
  created_at: string;
}
