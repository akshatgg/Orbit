import type { QuestionKind, RegistrationStatus } from "@/types/database";

/** One row of an event's guest list, as the organiser sees it. */
export type Guest = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  status: RegistrationStatus;
  ticket: string | null;
  answers: Record<string, unknown>;
  registeredAt: string;
  checkedInAt: string | null;
};

export type GuestQuestion = {
  id: string;
  label: string;
  kind: QuestionKind;
};

export const REGISTRATION_STATUSES: RegistrationStatus[] = [
  "going", "pending", "waitlisted", "awaiting_payment", "declined", "cancelled",
];

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  going: "Going",
  pending: "Pending",
  waitlisted: "Waitlisted",
  awaiting_payment: "Awaiting payment",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** What `check_in(event_id, code)` returns. */
export type CheckInResult = {
  result: "checked_in" | "already" | "not_found" | "not_going";
  name?: string | null;
  ticket?: string | null;
  status?: RegistrationStatus;
  checked_in_at?: string | null;
  registration_id?: string;
};
