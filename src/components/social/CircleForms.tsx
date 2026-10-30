"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChipGroup, type ChipOption } from "@/components/ui/ChipGroup";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createChannel, createCircle, createInviteLink, inviteByEmail, postAnnouncement, updateChannel, updateCircle, type FormState } from "@/lib/social/actions";
import type { GroupDetail } from "@/types/social";
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

/**
 * Invite one person by the email they use on ORBIT. `roles` (community moderators) adds the
 * Member / Moderator choice: a moderator invite makes them one on accepting, or at once if they're
 * already a member.
 */
export function InviteByEmailForm({ groupId, roles = false }: { groupId: string; roles?: boolean }) {
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
      {roles && (
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Invite as</legend>
          <span aria-hidden className="text-xs text-muted">As</span>
          <SegmentedRadios name="role" options={ROLES} defaultValue="member" />
        </fieldset>
      )}
      <FormMessage state={state} />
    </form>
  );
}

const ROLES = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Moderator" },
] as const;

/** A small segmented control that submits with its form, as radios. */
export function SegmentedRadios({ name, options, defaultValue, disabled }: {
  name: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <span className={`inline-flex max-w-full gap-0.5 rounded-full bg-ink/[0.06] p-1 light:rounded-xl ${disabled ? "opacity-60" : ""}`}>
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer rounded-full px-3 py-1 text-xs font-medium text-muted transition duration-200 hover:text-fg has-checked:bg-[var(--seg-on)] has-checked:text-fg has-checked:shadow-[var(--seg-shadow)] has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-accent light:rounded-lg motion-reduce:transition-none"
        >
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} disabled={disabled} className="sr-only" />
          {o.label}
        </label>
      ))}
    </span>
  );
}

const VISIBILITIES = [
  { value: "public", label: "Anyone" },
  { value: "approval", label: "Approval" },
  { value: "private", label: "Invite only" },
] as const;

export const POST_POLICIES = [
  { value: "everyone", label: "Everyone" },
  { value: "moderators", label: "Moderators" },
] as const;

/** What a channel's two forms share: name, description, who can join and post, its categories. */
function ChannelFields({ prefix, state, group, categories, locked = false }: {
  prefix: string;
  state: FormState;
  group?: Pick<GroupDetail, "name" | "description" | "visibility" | "post_policy" | "categories">;
  categories: ChipOption[];
  /** Announcements: its access is fixed. */
  locked?: boolean;
}) {
  return (
    <>
      <Field label="Name" htmlFor={`${prefix}-name`} error={state?.fieldErrors?.name}>
        <Input id={`${prefix}-name`} name="name" defaultValue={group?.name} required minLength={2} maxLength={60} placeholder="Internships, Weekend hikes" />
      </Field>
      <Field label={group ? "Description" : "What's it for? (optional)"} htmlFor={`${prefix}-description`} error={state?.fieldErrors?.description}>
        <Input id={`${prefix}-description`} name="description" defaultValue={group?.description ?? ""} maxLength={500} />
      </Field>
      {!locked && (
        <>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-fg/90">Who can join</legend>
            <SegmentedRadios name="visibility" options={VISIBILITIES} defaultValue={group?.visibility ?? "public"} />
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-fg/90">Who can post</legend>
            <SegmentedRadios name="post_policy" options={POST_POLICIES} defaultValue={group?.post_policy ?? "everyone"} />
          </fieldset>
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-fg/90">Categories <span className="font-normal text-muted">(new events in these get posted here)</span></p>
              <div className="max-h-48 overflow-y-auto">
                <ChipGroup name="category_slugs" options={categories} defaultValue={group?.categories?.map((c) => c.slug ?? "").filter(Boolean)} max={10} />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** "New channel" (a community's moderators): folded until asked for; opens the channel once created. */
export function CreateChannelForm({ community, categories }: { community: string; categories: ChipOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(createChannel.bind(null, community), null);
  return (
    <details className="glass group rounded-[22px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[22px] p-4 text-sm font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
        <SocialIcon name="plus" className="h-4 w-4 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" />
        New channel
      </summary>
      <form action={action} className="space-y-3 px-4 pb-4">
        <ChannelFields prefix="new-channel" state={state} categories={categories} />
        {state?.error && <FormMessage state={state} />}
        <SubmitButton size="sm" pendingText="Creating…">Create channel</SubmitButton>
      </form>
    </details>
  );
}

/** A channel's settings (its moderators). */
export function ChannelSettingsForm({ group, categories }: { group: GroupDetail; categories: ChipOption[] }) {
  const locked = !!group.is_announcements;
  const [state, action] = useActionState<FormState, FormData>(updateChannel.bind(null, group.id, locked), null);
  return (
    <form action={action} className="space-y-3">
      <ChannelFields prefix="channel-settings" state={state} group={group} categories={categories} locked={locked} />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="sm" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}

const expiryFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

type InviteLink = { url: string; expiresAt: string | null };

/**
 * Makes (or reuses) a shareable link on the first click — never before — and copies it, then shows
 * it with when it stops working and, where the device has one, a Share button for the share sheet.
 */
export function InviteLinkButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [state, setState] = useState<"idle" | "working" | "copied" | "shown">("idle");
  const [link, setLink] = useState<InviteLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mint(): Promise<InviteLink> {
    const result = await createInviteLink(groupId);
    if (!result.ok) throw new Error(result.error);
    return { url: new URL(result.path, window.location.origin).toString(), expiresAt: result.expiresAt };
  }

  async function copy() {
    setError(null);
    setState("working");
    const minting = link ? Promise.resolve(link) : mint();
    // Started inside the click (before any await) so Safari allows the clipboard write.
    const copying = writeClipboard(minting.then((l) => l.url)).then(() => true, () => false);
    let value: InviteLink;
    try {
      value = await minting;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make a link");
      setState("idle");
      return;
    }
    setLink(value);
    // Copy refused: the link is shown below to copy by hand.
    if (!(await copying)) return setState("shown");
    setState("copied");
    setTimeout(() => setState((s) => (s === "copied" ? "shown" : s)), 2500);
  }

  async function share() {
    if (!link) return;
    try {
      await navigator.share({ title: `Join ${groupName} on ORBIT`, url: link.url });
    } catch {
      // Share sheet dismissed.
    }
  }

  const canShare = !!link && typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={copy} disabled={state === "working"}>
          <SocialIcon name={state === "copied" ? "check" : "link"} className="h-4 w-4" />
          <span aria-live="polite">{state === "copied" ? "Link copied" : state === "working" ? "Making a link…" : "Copy invite link"}</span>
        </Button>
        {canShare && (
          <Button type="button" variant="ghost" size="sm" onClick={share}>
            <SocialIcon name="share" className="h-4 w-4" /> Share
          </Button>
        )}
      </div>
      {link && (
        <div className="space-y-1">
          <p className="break-all rounded-xl bg-ink/[0.05] px-3 py-2 text-xs text-muted">{link.url}</p>
          {link.expiresAt && <p className="text-xs text-subtle">Works until {expiryFmt.format(new Date(link.expiresAt))}</p>}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

/** Copies `text` once it resolves: as a promised ClipboardItem (Safari), else plain writeText. */
async function writeClipboard(text: Promise<string>) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
  } catch {
    await navigator.clipboard.writeText(await text);
  }
}

/** Community admins post a notice to members. */
export function AnnouncementForm({ groupId }: { groupId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(postAnnouncement.bind(null, groupId), null);
  // The result a person has moved past: "Posted" fades after a few seconds or once they type again.
  const [dismissed, setDismissed] = useState<FormState>(null);
  useEffect(() => {
    if (!state?.ok) return;
    form.current?.reset();
    const timer = setTimeout(() => setDismissed(state), 4000);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <form ref={form} action={action} className="glass space-y-2 rounded-[22px] p-4" noValidate>
      <label htmlFor={`announce-${groupId}`} className="block text-sm font-semibold tracking-tight">Post an announcement</label>
      <Textarea
        id={`announce-${groupId}`}
        name="body"
        required
        maxLength={1000}
        rows={3}
        placeholder="Tell members what's coming up"
        className="min-h-20"
        onChange={() => state && state !== dismissed && setDismissed(state)}
      />
      <div className="flex items-center justify-between gap-3">
        <FormMessage state={state === dismissed ? null : state} />
        <SubmitButton size="sm" pendingText="Posting…" className="ml-auto">Post</SubmitButton>
      </div>
    </form>
  );
}
