"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export type PayoutActionState = { ok: boolean; error?: string } | null;

/** One-button form for a payouts server action (it redirects to Stripe on success). */
export function PayoutActionForm({
  action,
  orgId,
  label,
  pendingText = "Opening Stripe…",
  variant = "primary",
  disabled,
}: {
  action: (prev: PayoutActionState, formData: FormData) => Promise<PayoutActionState>;
  orgId: string;
  label: string;
  pendingText?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="org" value={orgId} />
      <SubmitButton variant={variant} size="lg" full pendingText={pendingText} disabled={disabled}>
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
