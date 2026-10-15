"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RegistrationStatus } from "@/types/database";
import { getCurrentUser } from "@/lib/auth";
import { createTicketCheckout } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { answersFromForm, friendlyError, validateAnswers, type Question } from "./logic";

export type RegisterState =
  | { ok: true; status: RegistrationStatus; registrationId: string; paymentError?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; signIn?: boolean }
  | null;

const RegisterInput = z.object({
  eventId: z.guid(),
  ticketTypeId: z.union([z.guid(), z.literal("")]).optional(),
});

function revalidateTickets(eventId: string, registrationId?: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/tickets");
  if (registrationId) revalidatePath(`/tickets/${registrationId}`);
}

/** Registers the signed-in user through register_for_event and reports the resulting status. */
export async function registerForEvent(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = RegisterInput.safeParse({
    eventId: formData.get("eventId"),
    ticketTypeId: formData.get("ticketTypeId") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Choose a valid ticket" };
  const { eventId, ticketTypeId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to get a ticket", signIn: true };

  const supabase = await createClient();
  const { data: questions } = await supabase.from("event_questions").select("id, label, kind, options, required")
    .eq("event_id", eventId).order("sort_order").order("created_at");
  const qs = (questions ?? []) as Question[];
  const { answers, errors } = validateAnswers(qs, answersFromForm(qs, formData));
  const firstBad = qs.find((q) => errors[q.id]);
  if (firstBad) return { ok: false, error: `Please answer: ${firstBad.label}`, fieldErrors: errors };

  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
    p_ticket_type_id: ticketTypeId || null,
    p_answers: answers,
  });
  if (error || !data) return { ok: false, error: friendlyError(error?.message) };

  const registration = data as { id: string; status: RegistrationStatus };
  revalidateTickets(eventId, registration.id);

  if (registration.status === "awaiting_payment") {
    const checkout = await createTicketCheckout(registration.id);
    if (checkout.ok) redirect(checkout.url);
    return { ok: true, status: registration.status, registrationId: registration.id, paymentError: checkout.error };
  }
  return { ok: true, status: registration.status, registrationId: registration.id };
}

export type SimpleResult = { ok: true } | { ok: false; error: string };

/** Cancels the signed-in user's registration (frees the place for the waitlist). */
export async function cancelRegistration(eventId: string): Promise<SimpleResult> {
  if (!z.guid().safeParse(eventId).success) return { ok: false, error: "Event not found" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_registration", { p_event_id: eventId });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidateTickets(eventId, (data as { id?: string } | null)?.id);
  return { ok: true };
}

/** "Complete payment" for a registration that is awaiting payment. Redirects to checkout. */
export async function completePayment(registrationId: string): Promise<SimpleResult> {
  if (!z.guid().safeParse(registrationId).success) return { ok: false, error: "Ticket not found" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { data } = await supabase.from("registrations").select("id, status")
    .eq("id", registrationId).eq("user_id", user.id).maybeSingle();
  if (!data) return { ok: false, error: "Ticket not found" };
  if (data.status !== "awaiting_payment") return { ok: false, error: "This ticket doesn't need payment" };

  const checkout = await createTicketCheckout(registrationId);
  if (checkout.ok) redirect(checkout.url);
  return { ok: false, error: checkout.error };
}
