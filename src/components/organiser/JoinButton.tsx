"use client";

import { useActionState } from "react";
import { acceptTeamInvite } from "@/lib/organiser/org-actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** "Join team" button for /join/<code>. On success the action redirects into Studio. */
export function JoinButton({ code, orgName }: { code: string; orgName: string }) {
  const [state, action] = useActionState(async () => acceptTeamInvite(code), null);
  return (
    <form action={action} className="space-y-3">
      {state && !state.ok && <p role="alert" className="text-center text-sm text-red-300">{state.error}</p>}
      <SubmitButton size="lg" full className="glow" pendingText="Joining…" aria-label={`Join ${orgName}`}>
        Join team
      </SubmitButton>
    </form>
  );
}
