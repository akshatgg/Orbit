"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createCircle, createInviteLink, inviteByEmail, postAnnouncement, updateCircle, type FormState } from "@/lib/social/actions";
import { SocialIcon } from "./icons";

/** "New circle": name + optional description; opens the circle once created. */
export function CreateCircleForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(createCircle, null);
  return (
    <form action={action} className="glass space-y-3 rounded-[22px] p-4" noValidate>
      <p className="text-sm font-semibold tracking-tight">Start a circle</p>
      <Field label="Name" htmlFor="circle-name" error={state?.fieldErrors?.name}>
        <Input id="circle-name" name="name" required minLength={2} maxLength={60} placeholder="Flatmates, Course friends, Climbing crew" autoFocus={autoFocus} />
      </Field>
      <Field label="What's it for? (optional)" htmlFor="circle-description" error={state?.fieldErrors?.description}>
        <Input id="circle-description" name="description" maxLength={500} placeholder="Weekend plans and careers fairs" />
      </Field>
      {state?.error && !state.fieldErrors && <FormMessage state={state} />}
      <SubmitButton pendingText="Creating…">Create circle</SubmitButton>
    </form>
  );
}

/** Rename / re-describe (circle admins). */
export function RenameCircleForm({ groupId, name, description }: { groupId: string; name: string; description: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(updateCircle.bind(null, groupId), null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <Field label="Name" htmlFor="rename-name" error={state?.fieldErrors?.name}>
        <Input id="rename-name" name="name" defaultValue={name} required minLength={2} maxLength={60} />
      </Field>
      <Field label="Description" htmlFor="rename-description" error={state?.fieldErrors?.description}>
        <Input id="rename-description" name="description" defaultValue={description ?? ""} maxLength={500} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="sm" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}

/** Invite one person by the email they use on ORBIT. */
export function InviteByEmailForm({ groupId }: { groupId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(inviteByEmail.bind(null, groupId), null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2" noValidate>
      <label htmlFor={`invite-${groupId}`} className="block text-sm font-medium text-fg/90">Invite by email</label>
      <div className="flex gap-2">
        <Input id={`invite-${groupId}`} name="email" type="email" required placeholder="friend@university.ac.uk" autoComplete="off" aria-invalid={!!state?.error || undefined} />
        <SubmitButton variant="secondary" pendingText="Sending…" className="shrink-0">Invite</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** Makes (or reuses) a shareable link and copies it; falls back to the share sheet. */
export function InviteLinkButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [state, setState] = useState<"idle" | "working" | "copied" | "shown">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setState("working");
    const result = await createInviteLink(groupId);
    if (!result.ok) {
      setError(result.error);
      setState("idle");
      return;
    }
    const url = new URL(result.path, window.location.origin).toString();
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("shown"), 2000);
    } catch {
      try {
        if (!navigator.share) throw new Error("no share");
        await navigator.share({ title: `Join ${groupName} on ORBIT`, url });
      } catch {
        // Show it so it can be copied by hand.
      }
      setState("shown");
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" size="sm" onClick={run} disabled={state === "working"}>
        <SocialIcon name="link" className="h-4 w-4" />
        <span aria-live="polite">{state === "copied" ? "Link copied" : state === "working" ? "Making a link…" : "Copy invite link"}</span>
      </Button>
      {link && state !== "copied" && (
        <p className="break-all rounded-xl bg-ink/[0.05] px-3 py-2 text-xs text-muted">{link}</p>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

/** Community admins post a notice to members. */
export function AnnouncementForm({ groupId }: { groupId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(postAnnouncement.bind(null, groupId), null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="glass space-y-2 rounded-[22px] p-4" noValidate>
      <label htmlFor={`announce-${groupId}`} className="block text-sm font-semibold tracking-tight">Post an announcement</label>
      <Textarea id={`announce-${groupId}`} name="body" required maxLength={1000} rows={3} placeholder="Tell members what's coming up" className="min-h-20" />
      <div className="flex items-center justify-between gap-3">
        <FormMessage state={state} />
        <SubmitButton size="sm" pendingText="Posting…" className="ml-auto">Post</SubmitButton>
      </div>
    </form>
  );
}
