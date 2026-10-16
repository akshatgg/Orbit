"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { completeOnboarding } from "@/lib/profile/actions";
import { hasExplorerGoal, landingPath, stepsFor, type StepKey } from "@/lib/profile/flow";
import { draftErrors, stepErrors, type ProfileDraft } from "@/lib/profile/schema";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { ApplyForm } from "@/components/organiser/ApplyForm";
import {
  AboutStep,
  AvailabilityStep,
  DescribeStep,
  EventsStep,
  GoalsStep,
  InterestsStep,
  type CategoryOption,
} from "./ProfileSteps";

type Copy = { eyebrow: string; title: string; subtitle: string };

const COPY: Record<StepKey, Copy> = {
  goals: { eyebrow: "Welcome", title: "What brings you to ORBIT?", subtitle: "Pick everything that fits. You can change it any time." },
  describe: { eyebrow: "About you", title: "Which describes you?", subtitle: "So we show events that actually fit." },
  about: { eyebrow: "About you", title: "Tell us about you", subtitle: "Who's setting up events on ORBIT?" },
  interests: { eyebrow: "Interests", title: "What are you into?", subtitle: "Career areas you're curious about, and what you enjoy outside work." },
  events: { eyebrow: "Your kind of events", title: "Pick your kind of events", subtitle: "Tell us what you want to see more of." },
  availability: { eyebrow: "Availability", title: "When are you usually free?", subtitle: "Optional. Skip it if your week changes a lot." },
  organisation: { eyebrow: "Your organisation", title: "Set up your organisation", subtitle: "A few details so people can find and trust your events." },
};

/**
 * The onboarding flow: one question per screen. Which screens appear depends on the goals picked
 * on the first one (see lib/profile/flow). Answers stay in memory until the last profile step,
 * which saves everything in one server action. The organisation application (hosts) comes after.
 */
export function OnboardingWizard({ initial, categories, next, email, university }: {
  initial: ProfileDraft;
  categories: CategoryOption[];
  /** Safe relative path to land on after setup, or null. */
  next: string | null;
  email: string;
  university: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = stepsFor(draft.goals);
  const total = steps.length;
  const key = steps[Math.min(index, total - 1)];
  const copy = COPY[key];
  const explorer = hasExplorerGoal(draft.goals);
  const landing = landingPath(draft.goals, next);
  // The step that saves the profile: the last one before the organisation application.
  const saveKey = steps.filter((s) => s !== "organisation").at(-1)!;
  const isSaveStep = key === saveKey;

  useEffect(() => {
    if (index > 0) headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  function update(patch: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const rest = { ...e };
      for (const k of Object.keys(patch)) delete rest[k];
      return rest;
    });
    setFormError(null);
  }

  function go(to: number) {
    setErrors({});
    setFormError(null);
    setIndex(Math.max(0, to));
    window.scrollTo({ top: 0 });
  }

  function save(final: ProfileDraft) {
    startTransition(async () => {
      const result = await completeOnboarding(final, next);
      if (!result.ok) {
        setFormError(result.error);
        setErrors(result.fieldErrors ?? {});
        const field = Object.keys(result.fieldErrors ?? {})[0];
        const bad = stepsFor(final.goals).findIndex(
          (s) => s !== "organisation" && field in stepErrors(s, final),
        );
        if (bad >= 0) setIndex(bad);
        return;
      }
      // Hosts continue to the organisation application; everyone else is done.
      if (steps.includes("organisation")) go(index + 1);
      else router.replace(result.landing ?? landing);
    });
  }

  function onContinue() {
    if (key === "organisation") return;
    const errs = stepErrors(key, draft);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    if (isSaveStep) {
      const bad = draftErrors(draft);
      if (Object.keys(bad).length) {
        setErrors(bad);
        setFormError(Object.values(bad)[0]);
        return;
      }
      save(draft);
    } else go(index + 1);
  }

  return (
    <Shell
      asForm={key !== "organisation"}
      onSubmit={onContinue}
    >
      <header className="sticky top-0 z-10 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] md:static md:px-6 md:pt-6">
        <div className="glass-strong rounded-full py-2 pl-2 pr-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={pending || index === 0}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.08] hover:text-fg disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={index + 1}
              aria-valuetext={`Step ${index + 1} of ${total}`}
              className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10"
            >
              <div
                className="bg-gradient h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-subtle">{index + 1}/{total}</span>
          </div>
        </div>
      </header>

      <main key={key} className="flex-1 px-5 pb-8 pt-5 md:px-10 md:pt-8 transition duration-300 ease-out starting:translate-y-3 starting:opacity-0">
        {key === "goals" && (
          <div className="-mb-1 flex items-center gap-3">
            <OrbitEmblem size={64} />
            <p className="font-display text-xs font-semibold tracking-[0.4em] text-muted">ORBIT</p>
          </div>
        )}
        <p className="font-display text-xs font-medium text-muted">{copy.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2.5 text-[1.7rem] font-semibold leading-tight tracking-tight outline-none">
          {key === "goals" && initial.full_name ? (
            <>
              Hi {initial.full_name.split(/\s+/)[0]}.
              <br />
              <span className="text-fg">{copy.title}</span>
            </>
          ) : (
            copy.title
          )}
        </h1>
        <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>

        <div className="mt-7">
          {key === "goals" && <GoalsStep draft={draft} update={update} errors={errors} />}
          {key === "describe" && <DescribeStep draft={draft} update={update} errors={errors} />}
          {key === "about" && <AboutStep draft={draft} update={update} errors={errors} />}
          {key === "interests" && <InterestsStep draft={draft} update={update} errors={errors} />}
          {key === "events" && <EventsStep draft={draft} update={update} errors={errors} categories={categories} />}
          {key === "availability" && <AvailabilityStep draft={draft} update={update} errors={errors} />}
          {key === "organisation" && (
            <div className="space-y-6">
              <p className="glass flex gap-3 rounded-2xl p-4 text-sm leading-relaxed text-muted">
                <span aria-hidden className="text-lg">🔎</span>
                <span>
                  <strong className="font-semibold text-fg">Every organisation is reviewed first.</strong> Until an ORBIT admin
                  approves yours you can&apos;t create events, not even drafts. We&apos;ll email you the moment it&apos;s approved.
                </span>
              </p>
              <ApplyForm
                defaultEmail={email}
                defaultUniversity={university}
                defaultName=""
                submitLabel="Submit for review"
                after={
                  <Link
                    href={landing}
                    className="block py-2 text-center text-sm text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
                  >
                    I&apos;ll do this later
                  </Link>
                }
              />
            </div>
          )}
        </div>
      </main>

      {key !== "organisation" && (
        <footer className="sticky bottom-0 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-6 md:static md:px-6 md:pb-6">
          {formError && <p role="alert" className="mb-3 text-center text-sm text-red-300">{formError}</p>}
          <div className="glass-strong flex gap-2 rounded-full p-1.5">
            {key === "availability" && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={pending}
                onClick={() => {
                  update({ availability: {} });
                  const cleared = { ...draft, availability: {} };
                  const bad = draftErrors(cleared);
                  if (Object.keys(bad).length) {
                    setErrors(bad);
                    setFormError(Object.values(bad)[0]);
                  } else save(cleared);
                }}
              >
                Skip
              </Button>
            )}
            <Button type="submit" size="lg" full disabled={pending} aria-busy={pending}>
              {pending
                ? explorer ? "Building your feed…" : "Saving…"
                : isSaveStep && !steps.includes("organisation") ? "Finish" : "Continue"}
            </Button>
          </div>
        </footer>
      )}
    </Shell>
  );
}

/** A form (so Enter continues) for question steps; a plain div for the organisation step, which has its own form. */
function Shell({ asForm, onSubmit, children }: { asForm: boolean; onSubmit: () => void; children: React.ReactNode }) {
  const className = "flex min-h-dvh flex-col md:min-h-0 md:w-full md:rounded-[32px] md:border md:border-ink/10 md:bg-surface md:shadow-[var(--card-shadow)]";
  if (!asForm) return <div className={className}>{children}</div>;
  return (
    <form
      noValidate
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
