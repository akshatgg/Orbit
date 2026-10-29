"use client";

import { useActionState, useEffect } from "react";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { saveCommunity, type CommunityFormState } from "@/app/admin/communities/actions";
import { toast } from "./Toaster";

export type CommunityFormValues = {
  id?: string;
  name: string;
  slug: string | null;
  description: string | null;
  /** Every category, main one first. */
  category_ids: string[];
  university: string | null;
  visibility: "public" | "approval" | "private";
  allow_member_shares?: boolean;
  cover_url: string | null;
};

const VISIBILITY = [
  ["public", "Open: anyone can join"],
  ["approval", "Approval: people ask, moderators approve"],
  ["private", "Private: invite only, hidden from the directory"],
] as const;

/** Create or edit a community (Orbit admins). */
export function CommunityForm({ community, categories }: { community?: CommunityFormValues; categories: { id: string; name: string }[] }) {
  const [state, action] = useActionState<CommunityFormState, FormData>(saveCommunity.bind(null, community?.id ?? null), null);
  useEffect(() => {
    if (state?.ok) toast(state.message ?? "Saved");
  }, [state]);
  const fe = state?.fieldErrors ?? {};
  const v = (key: keyof CommunityFormValues, fallback: string) => state?.values?.[key] ?? fallback;
  const p = community?.id ?? "new";

  return (
    <form action={action} className="grid gap-4 p-5 sm:grid-cols-2" noValidate>
      <Field label="Name" htmlFor={`${p}-name`} error={fe.name} required>
        <Input id={`${p}-name`} name="name" defaultValue={v("name", community?.name ?? "")} required maxLength={60} placeholder="Technology & AI" />
      </Field>
      <Field label="Slug" htmlFor={`${p}-slug`} error={fe.slug} hint="The address: /communities/<slug>. Made from the name when blank.">
        <Input id={`${p}-slug`} name="slug" defaultValue={v("slug", community?.slug ?? "")} maxLength={60} placeholder="technology-ai" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description" htmlFor={`${p}-description`} error={fe.description}>
          <Textarea id={`${p}-description`} name="description" defaultValue={v("description", community?.description ?? "")} maxLength={500} rows={3} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <fieldset aria-describedby={`${p}-categories-hint`} aria-invalid={fe.category_ids ? true : undefined}>
          <legend className="mb-1.5 block text-sm font-medium text-fg/90">
            Categories<span className="ml-0.5 text-accent">*</span>
          </legend>
          <ChipGroup
            key={state?.categoryIds?.join(",") ?? "initial"}
            name="category_ids"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            defaultValue={state?.categoryIds ?? community?.category_ids ?? []}
          />
          {fe.category_ids ? (
            <p className="mt-1.5 text-xs text-red-300">{fe.category_ids}</p>
          ) : (
            <p id={`${p}-categories-hint`} className="mt-1.5 text-xs text-muted">
              Upcoming events in any of these show in the community&apos;s feed. The first one you pick is its main category.
            </p>
          )}
        </fieldset>
      </div>
      <Field label="University" htmlFor={`${p}-university`} error={fe.university} hint="Optional: only this university's events match.">
        <Input id={`${p}-university`} name="university" defaultValue={v("university", community?.university ?? "")} maxLength={120} />
      </Field>
      <Field label="Who can join" htmlFor={`${p}-visibility`} error={fe.visibility}>
        <Select id={`${p}-visibility`} name="visibility" defaultValue={v("visibility", community?.visibility ?? "public")}>
          {VISIBILITY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      <Field label="Cover image" htmlFor={`${p}-cover`} error={fe.cover_url} hint="Optional https:// image link.">
        <Input id={`${p}-cover`} name="cover_url" type="url" defaultValue={v("cover_url", community?.cover_url ?? "")} maxLength={1000} />
      </Field>
      <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="allow_member_shares"
          defaultChecked={state?.values ? state.values.allow_member_shares === "on" : community?.allow_member_shares ?? true}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Members can share events here (otherwise only moderators)
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText={community ? "Saving…" : "Creating…"}>{community ? "Save changes" : "Create community"}</SubmitButton>
        {state?.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      </div>
    </form>
  );
}
