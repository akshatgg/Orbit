"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { completeOnboarding } from "@/lib/profile/actions";
import { STEPS, stepErrors, type ProfileDraft } from "@/lib/profile/schema";
import { OrbitGlowMark } from "./OrbitGlowMark";
import {
  AvailabilityStep,
  BasicsStep,
  CareerStep,
  EventsStep,
  PersonalStep,
  type CategoryOption,
} from "./ProfileSteps";

const COPY: Record<(typeof STEPS)[number]["key"], { title: string; subtitle: string }> = {
  basics: { title: "Let's get to know you", subtitle: "So we can surface events at your university and on your course." },
  career: { title: "What are you exploring?", subtitle: "Career areas you're curious about — not just the ones you've decided on." },
  personal: { title: "And outside work?", subtitle: "Socials, sport and society nights count too." },
  events: { title: "Your kind of events", subtitle: "Tell us what you want to see more of." },
  availability: { title: "When are you usually free?", subtitle: "Optional — skip it if your week changes a lot." },
};

/**
 * The onboarding flow: a welcome screen, then one step per screen. Answers stay in memory until
 * the final step, which saves everything in one server action and lands on the For You feed.
 */
export function OnboardingWizard({ initial, categories }: { initial: ProfileDraft; categories: CategoryOption[] }) {
  const [step, setStep] = useState(0); // 0 = welcome, 1..STEPS.length = questions
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const total = STEPS.length;
  const current = STEPS[step - 1];
  const isLast = step === total;

  useEffect(() => {
    if (step > 0) headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function update(patch: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    // Clear the errors for whatever the user just changed.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
    setFormError(null);
  }

  function go(to: number) {
    setErrors({});
    setFormError(null);
    setStep(to);
    window.scrollTo({ top: 0 });
  }

  function submit(final: ProfileDraft) {
    startTransition(async () => {
      const result = await completeOnboarding(final);
      // On success the action redirects to the feed, so we only get here on failure.
      if (result && !result.ok) {
        setFormError(result.error);
        const field = Object.keys(result.fieldErrors ?? {})[0];
        const bad = STEPS.findIndex((s) => Object.keys(stepErrors(s.key, final)).includes(field));
        if (bad >= 0) {
          setStep(bad + 1);
          setErrors(result.fieldErrors ?? {});
        }
      }
    });
  }

  function next() {
    if (!current) return go(1);
    const errs = stepErrors(current.key, draft);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    if (isLast) submit(draft);
    else go(step + 1);
  }

  if (step === 0) return <Welcome name={initial.full_name} onStart={() => go(1)} />;

  const copy = COPY[current.key];

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      className="flex min-h-dvh flex-col"
    >
      <header className="sticky top-0 z-10 bg-bg/80 px-5 pb-3 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={pending}
            aria-label="Back"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={step}
            aria-valuetext={`Step ${step} of ${total}`}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className="bg-gradient h-full rounded-full shadow-[0_0_12px_rgb(181_124_246/0.6)] transition-[width] duration-500 ease-out"
              style={{ width: `${(step / total) * 100}%` }}
            />
          </div>
          <span className="w-9 text-right text-xs tabular-nums text-muted">{step}/{total}</span>
        </div>
      </header>

      <main key={step} className="flex-1 px-5 pb-8 pt-4 transition duration-300 ease-out starting:translate-y-3 starting:opacity-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gradient">Step {step} · {current.title}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 font-display text-[1.65rem] font-semibold leading-tight outline-none">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>

        <div className="mt-7">
          {current.key === "basics" && <BasicsStep draft={draft} update={update} errors={errors} />}
          {current.key === "career" && <CareerStep draft={draft} update={update} errors={errors} />}
          {current.key === "personal" && <PersonalStep draft={draft} update={update} errors={errors} />}
          {current.key === "events" && <EventsStep draft={draft} update={update} errors={errors} categories={categories} />}
          {current.key === "availability" && <AvailabilityStep draft={draft} update={update} errors={errors} />}
        </div>
      </main>

      <footer className="sticky bottom-0 bg-linear-to-t from-bg via-bg/95 to-transparent px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-6">
        {formError && (
          <p role="alert" className="mb-3 text-center text-sm text-red-300">{formError}</p>
        )}
        <div className="flex gap-3">
          {isLast && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={pending}
              onClick={() => {
                update({ availability: {} });
                submit({ ...draft, availability: {} });
              }}
            >
              Skip
            </Button>
          )}
          <Button type="submit" size="lg" full disabled={pending} aria-busy={pending} className="glow">
            {pending ? "Building your feed…" : isLast ? "Finish" : "Continue"}
          </Button>
        </div>
      </footer>
    </form>
  );
}

function Welcome({ name, onStart }: { name: string; onStart: () => void }) {
  const first = name.split(/\s+/)[0];
  return (
    <main className="relative flex min-h-dvh flex-col items-center px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),2rem)] text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <OrbitGlowMark />
        <p className="mt-2 font-display text-xs font-semibold tracking-[0.45em] text-muted">ORBIT</p>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-tight">
          Welcome{first ? `, ${first}` : ""}.
          <br />
          <span className="text-gradient">Let&apos;s build your orbit.</span>
        </h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
          Career events, networking, socials and society nights — all in one place, ranked for you.
        </p>
        <ul className="mt-8 w-full max-w-xs space-y-2.5 text-left text-sm">
          {[
            "A feed ranked for your goals",
            "Every society and careers event in one place",
            "Reminders before deadlines close",
          ].map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl border border-line bg-surface/70 px-3.5 py-2.5">
              <span aria-hidden className="text-gradient font-semibold">✦</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="w-full max-w-xs pt-8">
        <Button size="lg" full className="glow" onClick={onStart} autoFocus>
          Get started
        </Button>
        <p className="mt-3 text-xs text-muted">5 quick steps · about a minute</p>
      </div>
    </main>
  );
}
