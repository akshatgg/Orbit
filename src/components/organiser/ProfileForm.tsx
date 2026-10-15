"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateOrganiserProfile, type FormState } from "@/lib/organiser/org-actions";
import { ImageUpload } from "./ImageUpload";

export function ProfileForm({ organiser }: {
  organiser: { id: string; name: string; bio: string | null; website: string | null; contact_email: string | null; logo_url: string | null; university: string | null };
}) {
  const [state, action] = useActionState<FormState, FormData>(updateOrganiserProfile, null);
  const [logo, setLogo] = useState(organiser.logo_url ?? "");
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="organiser_id" value={organiser.id} />
      <ImageUpload bucket="organiser-logos" shape="logo" label="Logo" hint="Square, under 2 MB" name="logo_url" value={logo} onChange={setLogo} />
      <Field label="Name" htmlFor="name" required error={err("name")}>
        <Input id="name" name="name" defaultValue={organiser.name} maxLength={80} required aria-invalid={!!err("name")} />
      </Field>
      <Field label="University" htmlFor="university" error={err("university")}>
        <Input id="university" name="university" defaultValue={organiser.university ?? ""} maxLength={100} />
      </Field>
      <Field label="About" htmlFor="bio" error={err("bio")}>
        <Textarea id="bio" name="bio" defaultValue={organiser.bio ?? ""} maxLength={1000} rows={4} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Website" htmlFor="website" error={err("website")}>
          <Input id="website" name="website" inputMode="url" defaultValue={organiser.website ?? ""} aria-invalid={!!err("website")} />
        </Field>
        <Field label="Contact email" htmlFor="contact_email" required error={err("contact_email")}>
          <Input id="contact_email" name="contact_email" type="email" defaultValue={organiser.contact_email ?? ""} required aria-invalid={!!err("contact_email")} />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton full size="lg">Save profile</SubmitButton>
    </form>
  );
}
