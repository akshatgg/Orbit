import type { RegistrationMode } from "@/types/database";

/**
 * The four ways an organiser can take registrations (product notes §6.2), as shown in the editor.
 * The database stores them as `registration_mode` + `requires_approval`:
 *   tickets     → tickets,  no approval   (free or paid ORBIT tickets)
 *   application → tickets,  approval on   (questions + organiser approves each guest)
 *   external    → external                (button sends people to the organiser's own form)
 *   none        → none                    (information only)
 */
export type RegistrationChoice = "tickets" | "application" | "external" | "none";

export const REGISTRATION_CHOICES: { value: RegistrationChoice; label: string; description: string }[] = [
  { value: "tickets", label: "Free or paid tickets", description: "Guests get a QR ticket in ORBIT. Set capacity, waitlist and prices." },
  { value: "application", label: "Application form", description: "Guests answer your questions and you approve each one." },
  { value: "external", label: "External link", description: "Send people to your own form, Eventbrite or university portal." },
  { value: "none", label: "Info only", description: "No sign-up needed. Just turn up." },
];

export const EXTERNAL_LABELS = ["Apply now", "Register", "Get tickets", "Sign up", "Learn more"] as const;

export function toDbRegistration(choice: RegistrationChoice): {
  registration_mode: RegistrationMode;
  requires_approval: boolean;
} {
  switch (choice) {
    case "tickets":
      return { registration_mode: "tickets", requires_approval: false };
    case "application":
      return { registration_mode: "tickets", requires_approval: true };
    case "external":
      return { registration_mode: "external", requires_approval: false };
    case "none":
      return { registration_mode: "none", requires_approval: false };
  }
}

export function fromDbRegistration(mode: string, requiresApproval: boolean): RegistrationChoice {
  if (mode === "external") return "external";
  if (mode === "none") return "none";
  return requiresApproval ? "application" : "tickets";
}

/** Choices that sell / hand out ORBIT tickets (and so need ticket types). */
export function usesTickets(choice: RegistrationChoice) {
  return choice === "tickets" || choice === "application";
}

/** Card price range for a set of ticket prices: null when there are none. */
export function ticketPriceRange(prices: number[]): { price_min: number | null; price_max: number | null } {
  if (prices.length === 0) return { price_min: null, price_max: null };
  return { price_min: Math.min(...prices), price_max: Math.max(...prices) };
}
