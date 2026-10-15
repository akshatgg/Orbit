import "server-only";

// Notifications. Placeholder until the notifications feature lands.
// Features call these after the change has been saved; they must never throw.

/** An event's time/place changed, or it was cancelled → tell everyone registered. */
export async function notifyEventChanged(eventId: string, change: "updated" | "cancelled") {
  void eventId; void change;
}

/** An organiser approved/declined someone, or someone moved off the waitlist. */
export async function notifyRegistrationChanged(registrationId: string) {
  void registrationId;
}
