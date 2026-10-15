"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { savePreferences } from "@/lib/profile/actions";
import { draftErrors, type ProfileDraft } from "@/lib/profile/schema";
import {
  AvailabilityStep,
  BasicsStep,
  CareerStep,
  EventsStep,
  PersonalStep,
  type CategoryOption,
} from "./ProfileSteps";

/** Every onboarding answer on one page, reusing the wizard's step components. */
export function PreferencesForm({ initial, categories }: { initial: ProfileDraft; categories: CategoryOption[] }) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function update(patch: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
    setStatus(null);
  }

  function save() {
    const errs = draftErrors(draft);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setStatus({ ok: false, text: Object.values(errs)[0] });
      return;
    }
    const snapshot = draft;
    startTransition(async () => {
      const result = await savePreferences(snapshot);
      if (result.ok) {
        setSaved(snapshot);
        setStatus({ ok: true, text: "Saved. Your feed is updating with your new preferences." });
      } else {
        setErrors(result.fieldErrors ?? {});
        setStatus({ ok: false, text: result.error });
      }
    });
  }

  const props = { draft, update, errors };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4 px-4"
    >
      <Section title="About you">
        <BasicsStep {...props} />
      </Section>
      <Section title="Interests">
        <div className="space-y-7">
          <CareerStep {...props} />
          <PersonalStep {...props} />
        </div>
      </Section>
      <Section title="Events">
        <EventsStep {...props} categories={categories} />
      </Section>
      <Section title="When you're free">
        <AvailabilityStep {...props} />
      </Section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-10 -mx-4 bg-linear-to-t from-bg via-bg/95 to-transparent px-4 pb-2 pt-6">
        <div aria-live="polite" className="min-h-5 pb-2 text-center text-sm">
          {status && <span className={status.ok ? "text-emerald-300" : "text-red-300"}>{status.text}</span>}
        </div>
        <Button type="submit" size="lg" full disabled={pending || !dirty} aria-busy={pending} className={dirty ? "glow" : ""}>
          {pending ? "Saving…" : dirty ? "Save changes" : "All changes saved"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-4">
      <h2 className="mb-4 font-display text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
