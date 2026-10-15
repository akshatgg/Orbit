"use client";

import { useActionState, useEffect, useState } from "react";
import { ORGANISER_KINDS, UNIVERSITIES } from "@/lib/taxonomy";
import { applyAsOrganiser, checkSlugAvailable, type FormState } from "@/lib/organiser/org-actions";
import { isValidSlug, slugify } from "@/lib/organiser/slug";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ImageUpload } from "./ImageUpload";

type SlugCheck = "idle" | "checking" | "available" | "taken" | "invalid";

export function ApplyForm({ defaultEmail, defaultUniversity }: { defaultEmail: string; defaultUniversity: string }) {
  const [state, action] = useActionState<FormState, FormData>(applyAsOrganiser, null);
  const [v, setV] = useState({
    name: "", slug: "", kind: "society", university: defaultUniversity, bio: "", website: "",
    contact_email: defaultEmail, logo_url: "",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [check, setCheck] = useState<SlugCheck>("idle");
  const set = (k: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => state?.fieldErrors?.[k];

  // Debounced live uniqueness check.
  useEffect(() => {
    const slug = v.slug;
    if (!slug) return;
    let live = true;
    const t = setTimeout(async () => {
      if (!isValidSlug(slug)) return live && setCheck("invalid");
      setCheck("checking");
      const r = await checkSlugAvailable(slug);
      if (live) setCheck(r.available ? "available" : "taken");
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [v.slug]);

  const slugHint = {
    idle: "Your public page: orbit/o/your-name",
    checking: "Checking…",
    available: "✓ Available",
    taken: "Already taken — try another",
    invalid: "Use lowercase letters, numbers and hyphens",
  }[v.slug ? check : "idle"];

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Organiser name" htmlFor="name" required error={err("name")}>
        <Input
          id="name" name="name" required maxLength={80} autoComplete="organization"
          placeholder="e.g. Imperial Consulting Society" value={v.name} aria-invalid={!!err("name")}
          onChange={(e) => {
            const name = e.target.value;
            setV((s) => ({ ...s, name, slug: slugEdited ? s.slug : slugify(name) }));
          }}
        />
      </Field>

      <Field label="Page link" htmlFor="slug" required error={err("slug")}>
        <div className={`flex items-center overflow-hidden rounded-xl border bg-surface focus-within:border-violet ${err("slug") || check === "taken" ? "border-red-400" : "border-line"}`}>
          <span className="select-none border-r border-line px-3 py-2.5 text-sm text-muted">/o/</span>
          <input
            id="slug" name="slug" required maxLength={60} value={v.slug} aria-describedby="slug-status"
            aria-invalid={check === "taken" || check === "invalid" || !!err("slug")}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-fg outline-none"
            onChange={(e) => {
              setSlugEdited(true);
              set("slug")(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
          />
        </div>
        {!err("slug") && (
          <p id="slug-status" aria-live="polite" className={`text-xs ${check === "available" ? "text-emerald-300" : check === "taken" || check === "invalid" ? "text-red-300" : "text-muted"}`}>
            {slugHint}
          </p>
        )}
      </Field>

      <Field label="What kind of organiser are you?" htmlFor="kind" required error={err("kind")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Organiser type">
          {ORGANISER_KINDS.map((k) => (
            <label
              key={k.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                v.kind === k.value ? "border-gradient text-fg" : "border-line bg-surface text-muted hover:text-fg"
              }`}
            >
              <input type="radio" name="kind" value={k.value} checked={v.kind === k.value} onChange={() => set("kind")(k.value)} className="accent-violet" />
              {k.label}
            </label>
          ))}
        </div>
      </Field>

      <Field label="University" htmlFor="university" hint="Leave blank if you're not tied to one university." error={err("university")}>
        <Input id="university" name="university" list="universities" maxLength={100} value={v.university} onChange={(e) => set("university")(e.target.value)} />
        <datalist id="universities">
          {UNIVERSITIES.map((u) => <option key={u} value={u} />)}
        </datalist>
      </Field>

      <Field label="About you" htmlFor="bio" hint="What kind of events do you run, and who are they for?" error={err("bio")}>
        <Textarea id="bio" name="bio" maxLength={1000} rows={4} value={v.bio} onChange={(e) => set("bio")(e.target.value)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Website" htmlFor="website" error={err("website")}>
          <Input id="website" name="website" inputMode="url" placeholder="yoursociety.com" value={v.website} aria-invalid={!!err("website")} onChange={(e) => set("website")(e.target.value)} />
        </Field>
        <Field label="Contact email" htmlFor="contact_email" required hint="We'll use this about your application." error={err("contact_email")}>
          <Input id="contact_email" name="contact_email" type="email" required value={v.contact_email} aria-invalid={!!err("contact_email")} onChange={(e) => set("contact_email")(e.target.value)} />
        </Field>
      </div>

      <ImageUpload bucket="organiser-logos" shape="logo" label="Logo" hint="Square, under 2 MB" name="logo_url" value={v.logo_url} onChange={set("logo_url")} />

      <div className="space-y-3 pt-2">
        <FormMessage state={state} />
        <SubmitButton size="lg" full className="glow" pendingText="Sending application…" disabled={check === "taken" || check === "checking"}>
          Send application
        </SubmitButton>
      </div>
    </form>
  );
}
