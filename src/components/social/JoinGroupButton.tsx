"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { acceptInviteCode, type Result } from "@/lib/social/actions";

/** "Join circle" / "Join community" for an invite link. On success the action opens the group. */
export function JoinGroupButton({ code, name, label }: { code: string; name: string; label: string }) {
  const [state, action] = useActionState<Result | null>(async () => acceptInviteCode(code), null);
  return (
    <form action={action} className="space-y-3">
      {state && !state.ok && <p role="alert" className="text-center text-sm text-red-300">{state.error}</p>}
      <SubmitButton size="lg" full pendingText="Joining…" aria-label={`${label}: ${name}`}>
        {label}
      </SubmitButton>
    </form>
  );
}
