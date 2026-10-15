"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { addTeamMember, removeTeamMember, type FormState } from "@/lib/organiser/org-actions";
import type { TeamMember } from "@/lib/organiser/queries";

export function TeamPanel({ organiserId, members, isOwner, currentUserId }: {
  organiserId: string; members: TeamMember[]; isOwner: boolean; currentUserId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await addTeamMember(prev, fd);
    if (r?.ok) formRef.current?.reset();
    return r;
  }, null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove(m: TeamMember) {
    if (!window.confirm(`Remove ${m.full_name ?? m.email} from the team?`)) return;
    start(async () => {
      const r = await removeTeamMember(organiserId, m.user_id);
      if (!r.ok) setError(r.error);
      else { setError(null); router.refresh(); }
    });
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface" aria-label="Team members">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.full_name ?? m.email ?? "?"} src={m.avatar_url} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.full_name || m.email}{m.user_id === currentUserId && <span className="text-muted"> (you)</span>}</p>
              {m.full_name && <p className="truncate text-xs text-muted">{m.email}</p>}
            </div>
            <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{m.role === "owner" ? "Owner" : "Editor"}</Badge>
            {isOwner && m.user_id !== currentUserId && (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => remove(m)} aria-label={`Remove ${m.full_name ?? m.email}`}>Remove</Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      {isOwner ? (
        <form ref={formRef} action={action} className="space-y-3 rounded-2xl border border-line bg-surface/50 p-4" noValidate>
          <input type="hidden" name="organiser_id" value={organiserId} />
          <p className="text-sm font-medium">Add a team member</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label="Email" htmlFor="member-email" error={state?.fieldErrors?.email}>
              <Input id="member-email" name="email" type="email" required placeholder="name@university.ac.uk" />
            </Field>
            <Field label="Role" htmlFor="member-role">
              <Select id="member-role" name="role" defaultValue="editor">
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted">They need to have signed in to ORBIT once. Editors can manage events; owners can also manage the team.</p>
          <FormMessage state={state} />
          <SubmitButton pendingText="Adding…">Add member</SubmitButton>
        </form>
      ) : (
        <p className="text-xs text-muted">Only owners can add or remove team members.</p>
      )}
    </div>
  );
}
