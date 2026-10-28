"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RegistrationStatus } from "@/types/database";
import { ApiError } from "@/lib/api/client";
import { apiErrorCode } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { getCurrentUser } from "@/lib/auth";
import { createTicketCheckout } from "@/lib/payments";
import { answersFromForm, friendlyError, validateAnswers } from "./logic";
import { getEventQuestions } from "./queries";

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

/** Registers the signed-in user through the Orbit API and reports the resulting status. */
export async function registerForEvent(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = RegisterInput.safeParse({
    eventId: formData.get("eventId"),
    ticketTypeId: formData.get("ticketTypeId") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Choose a valid ticket" };
  const { eventId, ticketTypeId } = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to get a ticket", signIn: true };

  const qs = await getEventQuestions(eventId);
  if (!qs) return { ok: false, error: "This event is not open for registration" };
  const { answers, errors } = validateAnswers(qs, answersFromForm(qs, formData));
  const firstBad = qs.find((q) => errors[q.id]);
  if (firstBad) return { ok: false, error: `Please answer: ${firstBad.label}`, fieldErrors: errors };

  let registration: { id: string; status: RegistrationStatus };
  let checkoutUrl: string | null;
  try {
    const result = await authed.post<{ registration: { id: string; status: RegistrationStatus }; checkout_url: string | null }>(
      `/events/${eventId}/registrations`,
      { body: { ticket_type_id: ticketTypeId || null, answers } },
    );
    registration = result.registration;
    checkoutUrl = result.checkout_url;
  } catch (error) {
    return { ok: false, ...registrationError(error) };
  }
  revalidateTickets(eventId, registration.id);

  if (registration.status === "awaiting_payment") {
    if (checkoutUrl) redirect(checkoutUrl);
    // No session came back with the registration: ask again to learn why.
    const checkout = await createTicketCheckout(registration.id);
    if (checkout.ok) redirect(checkout.url);
    return { ok: true, status: registration.status, registrationId: registration.id, paymentError: checkout.error };
  }
  return { ok: true, status: registration.status, registrationId: registration.id };
}

/** The API's refusal as the event page shows it (its sentences come from the database rules). */
function registrationError(error: unknown): { error: string; signIn?: boolean } {
  if (!(error instanceof ApiError)) throw error;
  if (error.status === 401) return { error: "Sign in to get a ticket", signIn: true };
  return { error: friendlyError(apiErrorCode(error)) };
}

export type SimpleResult = { ok: true } | { ok: false; error: string };

/** Cancels the signed-in user's registration (frees the place for the waitlist). */
export async function cancelRegistration(eventId: string): Promise<SimpleResult> {
  if (!z.guid().safeParse(eventId).success) return { ok: false, error: "Event not found" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  try {
    await authed.del(`/events/${eventId}/registrations/me`);
  } catch (error) {
    return { ok: false, error: registrationError(error).error };
  }
  revalidateTickets(eventId);
  revalidatePath("/tickets/[registrationId]", "page");
  return { ok: true };
}

/** "Complete payment" for a registration that is awaiting payment. Redirects to checkout. */
export async function completePayment(registrationId: string): Promise<SimpleResult> {
  if (!z.guid().safeParse(registrationId).success) return { ok: false, error: "Ticket not found" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };

  const checkout = await createTicketCheckout(registrationId);
  if (checkout.ok) redirect(checkout.url);
  return { ok: false, error: checkout.error };
}
