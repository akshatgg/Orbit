"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { addTeamMember, createTeamInvite, removeTeamMember, revokeTeamInvite, type FormState } from "@/lib/organiser/org-actions";
import { inviteSummary, inviteUrl, isInviteActive } from "@/lib/organiser/invites";
import type { TeamInvite, TeamMember } from "@/lib/organiser/queries";

export function TeamPanel({ organiserId, members, isOwner, currentUserId, approved, invites }: {
  organiserId: string; members: TeamMember[]; isOwner: boolean; currentUserId: string; approved: boolean; invites: TeamInvite[];
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
      <ul className="glass divide-y divide-white/[0.07] rounded-[22px]" aria-label="Team members">
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

      {isOwner && <InviteLinks organiserId={organiserId} approved={approved} invites={invites} />}

      {isOwner ? (
        <form ref={formRef} action={action} className="glass space-y-3 rounded-[22px] p-4" noValidate>
          <input type="hidden" name="organiser_id" value={organiserId} />
          <p className="text-sm font-semibold tracking-tight">Add a team member</p>
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

/** Owner-only: share a link so teammates can join as editors. Unlocks once the organisation is approved. */
function InviteLinks({ organiserId, approved, invites }: { organiserId: string; approved: boolean; invites: TeamInvite[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = invites.filter((i) => isInviteActive({ ...i, org_status: "approved" }));

  async function copy(code: string) {
    const url = inviteUrl(window.location.origin, code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      window.prompt("Copy this invite link", url);
    }
  }

  function create() {
    start(async () => {
      const r = await createTeamInvite(organiserId);
      if (!r.ok) return setError(r.error);
      setError(null);
      router.refresh();
      void copy(r.code);
    });
  }

  function revoke(id: string) {
    start(async () => {
      const r = await revokeTeamInvite(id);
      if (!r.ok) return setError(r.error);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="glass space-y-3 rounded-[22px] p-4">
      <div>
        <p className="text-sm font-semibold tracking-tight">Invite link</p>
        <p className="mt-0.5 text-xs text-muted">
          {approved
            ? "Anyone signed in who opens the link can join your team as an editor. Links last 14 days."
            : "Invite links unlock once your organisation is approved."}
        </p>
      </div>

      {approved && active.length > 0 && (
        <ul className="divide-y divide-white/[0.07] rounded-2xl border border-white/10 bg-white/[0.03]" aria-label="Active invite links">
          {active.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-fg/90">/join/{i.code}</p>
                <p className="text-[11px] text-muted">{inviteSummary(i)}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => copy(i.code)}>
                {copied === i.code ? "Copied" : "Copy link"}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => revoke(i.id)}>Turn off</Button>
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <Button type="button" variant="secondary" disabled={!approved || pending} aria-busy={pending} onClick={create}>
        {pending ? "Working…" : active.length ? "Create another link" : "Create invite link"}
      </Button>
    </div>
  );
}
