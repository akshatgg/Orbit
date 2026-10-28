"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { acceptInviteCode, type Result } from "@/lib/social/actions";

/** "Join circle" for /join/circle/<code>. On success the action opens the circle. */
export function JoinCircleButton({ code, name }: { code: string; name: string }) {
  const [state, action] = useActionState<Result | null>(async () => acceptInviteCode(code), null);
  return (
    <form action={action} className="space-y-3">
      {state && !state.ok && <p role="alert" className="text-center text-sm text-red-300">{state.error}</p>}
      <SubmitButton size="lg" full pendingText="Joining…" aria-label={`Join ${name}`}>
        Join
      </SubmitButton>
    </form>
  );
}
