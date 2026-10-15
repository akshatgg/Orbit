"use client";

import { useState, useTransition } from "react";
import { cancelRegistration, completePayment } from "@/lib/tickets/actions";
import { Button, buttonClass } from "@/components/ui/Button";
import { Icon } from "./icons";
import { Sheet } from "./Sheet";

/** "Cancel registration" with a confirmation sheet. */
export function CancelRegistrationButton({ eventId, eventTitle, status, className }: {
  eventId: string; eventTitle: string; status: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const noun = status === "waitlisted" ? "waitlist place" : status === "pending" ? "request" : "ticket";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "text-sm font-medium text-muted underline-offset-4 hover:text-red-300 hover:underline"}
      >
        Cancel registration
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="cancel-title"
        title={<h2 id="cancel-title" className="font-display text-lg font-semibold">Cancel your {noun}?</h2>}
      >
        <p className="text-sm text-muted">
          You&apos;ll lose your place at <span className="text-fg">{eventTitle}</span>. If there&apos;s a waitlist, your spot goes to the next person.
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-5 grid gap-2 pb-6">
          <Button
            variant="danger"
            size="lg"
            full
            disabled={pending}
            aria-busy={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await cancelRegistration(eventId);
                if (res.ok) setOpen(false);
                else setError(res.error);
              })
            }
          >
            {pending ? "Cancelling…" : "Yes, cancel"}
          </Button>
          <Button variant="secondary" size="lg" full onClick={() => setOpen(false)}>
            Keep my {noun}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** "Complete payment" → checkout (payments feature). Shows its error when checkout isn't available. */
export function CompletePaymentButton({ registrationId, full = true }: { registrationId: string; full?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await completePayment(registrationId);
            if (!res.ok) setError(res.error);
          })
        }
        className={buttonClass({ size: "lg", full, className: "glow" })}
      >
        <Icon name="card" /> {pending ? "Opening checkout…" : "Complete payment"}
      </button>
      {error && <p role="alert" className="text-center text-sm text-orange">{error}</p>}
    </div>
  );
}
