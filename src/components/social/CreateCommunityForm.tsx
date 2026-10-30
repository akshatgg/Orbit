"use client";

import { useRef, useState, useTransition } from "react";
import { OrganiserLogo } from "@/components/organiser/OrganiserStatus";
import { VerifiedMark } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChipGroup, type ChipOption } from "@/components/ui/ChipGroup";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/Field";
import { createCommunity, type CommunityInput, type FormState } from "@/lib/social/actions";
import type { CreatableOrganisers } from "@/types/social";
import { POST_POLICIES, SegmentedRadios } from "./CircleForms";
import { SocialIcon } from "./icons";

const ACCESS = [
  { value: "public", label: "Open to everyone" },
  { value: "approval", label: "Approval to join" },
] as const;

/** The value the organisation picker sends for ORBIT's own (Orbit admins only). */
const NO_ORGANISER = "orbit";
const MAX_CHANNELS = 10;

type Organisation = CreatableOrganisers["items"][number];

/**
 * "Create a community": which organisation runs it (Orbit admins may pick ORBIT itself), name,
 * description, who can join, and the channels it starts with besides Announcements, each with
 * who can post and the categories whose new events it picks up. Opens the new community's home.
 */
export function CreateCommunityForm({ organisations, orbitAdmin, initialOrganiser, categories }: {
  /** Only those the viewer can create a community for. */
  organisations: Organisation[];
  orbitAdmin: boolean;
  initialOrganiser?: string;
  categories: ChipOption[];
}) {
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  // Row keys only: the fields themselves are read from the form on submit.
  const next = useRef(1);
  const [rows, setRows] = useState<number[]>([0]);

  const choices = [
    ...organisations.map((o) => o.id),
    ...(orbitAdmin ? [NO_ORGANISER] : []),
  ];
  const picked = initialOrganiser && choices.includes(initialOrganiser) ? initialOrganiser : choices[0];
  const errors = state?.fieldErrors ?? {};

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const organiser = String(data.get("organiser") ?? "");
    const input: CommunityInput = {
      organiserId: organiser && organiser !== NO_ORGANISER ? organiser : null,
      name: String(data.get("name") ?? ""),
      description: String(data.get("description") ?? ""),
      visibility: data.get("visibility") === "approval" ? "approval" : "public",
      channels: rows.map((row) => ({
        name: String(data.get(`channel-${row}-name`) ?? ""),
        post_policy: data.get(`channel-${row}-post_policy`) === "moderators" ? "moderators" : "everyone",
        category_slugs: data.getAll(`channel-${row}-categories`).map(String),
      })),
    };
    startTransition(async () => {
      setState(await createCommunity(input));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section aria-labelledby="community-org" className="glass space-y-3 rounded-[22px] p-4">
        <h2 id="community-org" className="text-sm font-semibold tracking-tight">Who runs it</h2>
        <div role="radiogroup" aria-labelledby="community-org" className="space-y-2">
          {organisations.map((o) => (
            <OrganiserChoice key={o.id} value={o.id} defaultChecked={picked === o.id}>
              <OrganiserLogo src={o.logo_url} name={o.name} size={36} className="rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate font-medium">{o.name} {o.is_verified && <VerifiedMark />}</span>
                <span className="block text-xs text-muted">Your team moderates it with you</span>
              </span>
            </OrganiserChoice>
          ))}
          {orbitAdmin && (
            <OrganiserChoice value={NO_ORGANISER} defaultChecked={picked === NO_ORGANISER}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <SocialIcon name="community" className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">ORBIT (no organisation)</span>
                <span className="block text-xs text-muted">Run by ORBIT&apos;s admins and the moderators you add</span>
              </span>
            </OrganiserChoice>
          )}
        </div>
        {errors.organiser && <p className="text-xs text-red-300">{errors.organiser}</p>}
      </section>

      <section aria-labelledby="community-about" className="glass space-y-4 rounded-[22px] p-4">
        <h2 id="community-about" className="text-sm font-semibold tracking-tight">About it</h2>
        <Field label="Name" htmlFor="community-name" error={errors.name} required>
          <Input id="community-name" name="name" required minLength={2} maxLength={60} placeholder="Acme Robotics Students" aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field label="What's it for? (optional)" htmlFor="community-description" error={errors.description}>
          <Textarea id="community-description" name="description" maxLength={500} rows={3} className="min-h-20" placeholder="Workshops, internships and news from our team" />
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-fg/90">Who can join</legend>
          <SegmentedRadios name="visibility" options={ACCESS} defaultValue="public" />
        </fieldset>
      </section>

      <section aria-labelledby="community-channels" className="space-y-3">
        <div className="px-1">
          <h2 id="community-channels" className="text-sm font-semibold tracking-tight">Starting channels</h2>
          <p className="mt-1 text-xs text-muted">
            An Announcements channel is always included: everyone who joins is in it, and only moderators post there.
            You can add more channels later.
          </p>
        </div>
        <ul className="space-y-3">
          {rows.map((row, i) => (
            <li key={row} className="glass space-y-3 rounded-[22px] p-4">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field label={`Channel ${i + 1}`} htmlFor={`channel-${row}-name`}>
                    <Input
                      id={`channel-${row}-name`}
                      name={`channel-${row}-name`}
                      defaultValue={row === 0 ? "General" : undefined}
                      required
                      minLength={2}
                      maxLength={60}
                      placeholder="Internships, Weekend hikes"
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((r) => r.filter((x) => x !== row))}
                  aria-label={`Remove channel ${i + 1}`}
                  className="shrink-0"
                >
                  Remove
                </Button>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-fg/90">Who can post</legend>
                <SegmentedRadios name={`channel-${row}-post_policy`} options={POST_POLICIES} defaultValue="everyone" />
              </fieldset>
              {categories.length > 0 && (
                <details className="group/cats">
                  <summary className="cursor-pointer list-none text-sm font-medium text-fg/90 [&::-webkit-details-marker]:hidden">
                    Categories <span className="font-normal text-muted">(optional: new events in these get posted here)</span>
                    <SocialIcon name="down" className="ml-1 inline h-3.5 w-3.5 text-subtle transition-transform group-open/cats:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    <ChipGroup name={`channel-${row}-categories`} options={categories} max={10} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
        {errors.channels && <p className="px-1 text-xs text-red-300">{errors.channels}</p>}
        {rows.length < MAX_CHANNELS && (
          <Button type="button" variant="secondary" size="sm" onClick={() => {
            const key = next.current++;
            setRows((r) => [...r, key]);
          }}>
            <SocialIcon name="plus" className="h-4 w-4" /> Add a channel
          </Button>
        )}
      </section>

      <div className="space-y-3">
        {state?.error && <FormMessage state={state} />}
        <Button type="submit" size="lg" full disabled={pending}>
          {pending ? "Creating…" : "Create community"}
        </Button>
      </div>
    </form>
  );
}

function OrganiserChoice({ value, defaultChecked, children }: { value: string; defaultChecked: boolean; children: React.ReactNode }) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 rounded-[18px] border border-ink/10 bg-ink/[0.04] px-3 py-2.5 text-sm transition-colors hover:bg-ink/[0.08] has-checked:border-accent/40 has-checked:bg-accent/[0.08] has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-accent">
      <input type="radio" name="organiser" value={value} defaultChecked={defaultChecked} className="sr-only" />
      {children}
      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink/25 group-has-checked:border-transparent group-has-checked:bg-accent group-has-checked:text-white">
        <SocialIcon name="check" className="hidden h-3.5 w-3.5 group-has-checked:block" strokeWidth={2.6} />
      </span>
    </label>
  );
}
