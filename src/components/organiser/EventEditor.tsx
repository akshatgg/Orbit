"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import type { EventForm } from "@/lib/organiser/event-form";
import { cancelEvent, deleteDraftEvent, saveEvent } from "@/lib/organiser/event-actions";
import { EDITOR_STEPS, validateEventForm, type EventIssue, type StepId } from "@/lib/organiser/schemas";
import { BasicsStep, type CategoryOption } from "./editor/BasicsStep";
import { RegistrationStep } from "./editor/RegistrationStep";
import { PreviewCard, ReviewStep } from "./editor/ReviewStep";
import { TicketsStep } from "./editor/TicketsStep";
import { WhenStep } from "./editor/WhenStep";

type Props = {
  organiser: { id: string; name: string; is_verified: boolean; stripe_charges_enabled: boolean };
  categories: CategoryOption[];
  initial: EventForm;
  eventId?: string;
  status?: string;
  originalStartsAt?: string | null;
  registrations?: number;
};

const toMap = (issues: EventIssue[]) => {
  const out: Record<string, string> = {};
  for (const i of issues) if (!out[i.path]) out[i.path] = i.message;
  return out;
};

export function EventEditor({ organiser, categories, initial, eventId: initialId, status: initialStatus = "draft", originalStartsAt = null, registrations = 0 }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState<StepId>("basics");
  const [eventId, setEventId] = useState(initialId ?? null);
  const [status, setStatus] = useState(initialStatus);
  const [issues, setIssues] = useState<EventIssue[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const live = status === "published";
  const stepIndex = EDITOR_STEPS.findIndex((s) => s.id === step);
  const errors = useMemo(() => toMap(issues), [issues]);
  const ctx = (intent: "draft" | "publish") => ({ intent, chargesEnabled: organiser.stripe_charges_enabled, originalStartsAt });
  const publishIssues = useMemo(() => {
    const r = validateEventForm(form, ctx("publish"));
    return r.ok ? [] : r.issues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, organiser.stripe_charges_enabled, originalStartsAt]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(patch: Partial<EventForm>) {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setNotice(null);
    // Clear errors for the fields being edited.
    setIssues((list) => list.filter((i) => !Object.keys(patch).some((k) => i.path === k || i.path.startsWith(`${k}.`))));
  }

  function goTo(next: StepId) {
    setStep(next);
    setNotice(null);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start" }));
  }

  function next() {
    const r = validateEventForm(form, ctx("draft"));
    const here = r.ok ? [] : r.issues.filter((i) => i.step === step);
    setIssues(here);
    if (here.length > 0) {
      setNotice({ tone: "error", text: here[0].message });
      return;
    }
    goTo(EDITOR_STEPS[Math.min(stepIndex + 1, EDITOR_STEPS.length - 1)].id);
  }

  function save(intent: "draft" | "publish") {
    startTransition(async () => {
      setNotice(null);
      const result = await saveEvent({ organiserId: organiser.id, eventId, intent, form });
      if (!result.ok) {
        if (result.id) setEventId(result.id);
        if (result.issues?.length) {
          setIssues(result.issues);
          if (!result.issues.some((i) => i.step === step)) goTo(result.issues[0].step);
        }
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setDirty(false);
      setEventId(result.id);
      setStatus(result.status);
      setIssues([]);
      // Keep ids so the next save updates rows instead of recreating them.
      setForm((f) => ({
        ...f,
        tickets: f.tickets.map((t, i) => ({ ...t, id: result.ticketIds[i] ?? t.id })),
        questions: f.questions.map((q, i) => ({ ...q, id: result.questionIds[i] ?? q.id })),
      }));
      if (result.status === "published" && (intent === "publish")) {
        router.push(live ? `/organiser?org=${organiser.id}&updated=${result.id}` : `/organiser?org=${organiser.id}&published=${result.id}`);
        return;
      }
      window.history.replaceState(null, "", `/organiser/events/${result.id}/edit`);
      setNotice({ tone: "ok", text: "Draft saved" });
    });
  }

  function cancel() {
    if (!eventId) return;
    startTransition(async () => {
      const r = await cancelEvent(eventId, reason);
      if (!r.ok) return setNotice({ tone: "error", text: r.error });
      setDirty(false);
      router.push(`/organiser?org=${organiser.id}&cancelled=${eventId}`);
    });
  }

  function remove() {
    if (!eventId || !window.confirm("Delete this draft? This can't be undone.")) return;
    startTransition(async () => {
      const r = await deleteDraftEvent(eventId);
      if (!r.ok) return setNotice({ tone: "error", text: r.error });
      setDirty(false);
      router.push(`/organiser?org=${organiser.id}&deleted=1`);
    });
  }

  const stepProps = { form, update, errors };
  const lastStep = step === "review";

  return (
    <div ref={top} className="scroll-mt-16">
      <div className="mx-4 mb-5" role="presentation">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span className="font-display font-medium text-muted">Step {stepIndex + 1} of {EDITOR_STEPS.length}</span>
          <span className="font-medium text-fg/80">{EDITOR_STEPS[stepIndex].label}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
          <div className="bg-gradient h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${((stepIndex + 1) / EDITOR_STEPS.length) * 100}%` }} />
        </div>
      </div>
      <nav aria-label="Event steps" className="scrollbar-none mb-6 flex gap-1.5 overflow-x-auto px-4">
        {EDITOR_STEPS.map((s, i) => {
          const active = s.id === step;
          const hasIssue = issues.some((x) => x.step === s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(s.id)}
              aria-current={active ? "step" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200 ${
                active ? "is-selected text-fg" : hasIssue ? "border-red-400/50 bg-red-400/10 text-red-300" : "glass text-muted hover:text-fg"
              }`}
            >
              <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${active ? "bg-gradient text-bg" : "bg-ink/[0.08]"}`}>{i + 1}</span>
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-40 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
        {step === "basics" && <BasicsStep {...stepProps} categories={categories} />}
        {step === "when" && <WhenStep {...stepProps} />}
        {step === "registration" && <RegistrationStep {...stepProps} />}
        {step === "tickets" && <TicketsStep {...stepProps} chargesEnabled={organiser.stripe_charges_enabled} organiserId={organiser.id} />}
        {step === "review" && (
          <>
            <ReviewStep form={form} organiser={organiser} issues={publishIssues} goTo={goTo} status={status} />
            {eventId && (live || status === "draft") && (
              <section className="mt-8 space-y-3 rounded-[22px] border border-red-400/20 bg-red-500/[0.04] p-4" aria-label="Danger zone">
                {live ? (
                  cancelling ? (
                    <div className="space-y-3">
                      <label htmlFor="cancel-reason" className="block text-sm font-medium">
                        Why is it cancelled? <span className="font-normal text-muted">Guests ({registrations}) will be told.</span>
                      </label>
                      <textarea id="cancel-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
                        className={inputClass} />
                      <div className="flex gap-2">
                        <Button type="button" variant="danger" onClick={cancel} disabled={busy || reason.trim().length < 3}>Cancel event</Button>
                        <Button type="button" variant="ghost" onClick={() => setCancelling(false)}>Keep event</Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="danger" onClick={() => setCancelling(true)}>Cancel this event…</Button>
                  )
                ) : (
                  <Button type="button" variant="danger" onClick={remove} disabled={busy}>Delete draft</Button>
                )}
              </section>
            )}
          </>
        )}
        </div>
        <aside aria-label="Live preview" className="sticky top-20 hidden lg:block">
          <p className="mb-3 font-display text-xs font-medium text-muted">Live preview</p>
          <PreviewCard form={form} organiser={organiser} stacked />
          <p className="mt-3 text-xs text-muted">This is how your event appears in the feed. It updates as you type.</p>
        </aside>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-strong pointer-events-auto mx-auto max-w-3xl space-y-2 rounded-[24px] p-2.5 lg:max-w-5xl">
          {notice && (
            <p role={notice.tone === "error" ? "alert" : "status"} className={`px-2 pt-1 text-xs ${notice.tone === "error" ? "text-red-300" : "text-emerald-300"}`}>
              {notice.text}
            </p>
          )}
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? (
              <Button type="button" variant="ghost" onClick={() => goTo(EDITOR_STEPS[stepIndex - 1].id)}>Back</Button>
            ) : (
              <Link href={`/organiser?org=${organiser.id}`} className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:bg-ink/[0.06] hover:text-fg">Close</Link>
            )}
            <div className="ml-auto flex gap-2">
              {!live && (
                <Button type="button" variant="secondary" onClick={() => save("draft")} disabled={busy}>
                  {busy ? "Saving…" : "Save draft"}
                </Button>
              )}
              {lastStep ? (
                <Button type="button" onClick={() => save("publish")} disabled={busy || publishIssues.length > 0}>
                  {busy ? "Saving…" : live ? "Save changes" : "Publish"}
                </Button>
              ) : (
                <Button type="button" onClick={next}>Next</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
