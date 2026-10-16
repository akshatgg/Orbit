"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { RegistrationStatus } from "@/types/database";
import { registerForEvent, type RegisterState } from "@/lib/tickets/actions";
import {
  STATUS_COPY,
  answerField,
  defaultTicketId,
  formatTicketPrice,
  registerLabel,
  registerVariant,
  ticketAvailability,
  type CtaState,
  type Question,
  type TicketOption,
} from "@/lib/tickets/logic";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";
import { SetupNudge } from "@/components/profile/SetupNudge";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { CompletePaymentButton } from "./RegistrationButtons";
import { CalendarButton } from "./EventExtras";
import { Icon, type IconName } from "./icons";
import { Sheet } from "./Sheet";

type Props = {
  eventId: string;
  eventTitle: string;
  dateLabel: string;
  cta: CtaState;
  signedIn: boolean;
  /** Finished profile setup. When false, the success screen nudges them to do it. */
  onboarded: boolean;
  tickets: TicketOption[];
  questions: Question[];
  requiresApproval: boolean;
  waitlistEnabled: boolean;
  priceLabel: string | null;
  availabilityLine: string | null;
  registrationId: string | null;
  googleCalendarUrl: string;
};

const ctaClass = buttonClass({ size: "lg", className: "shrink-0 px-6 lg:w-full" });

/** Sticky bottom action bar + the registration sheet for the event page. */
export function EventActions(props: Props) {
  const { eventId, cta, signedIn } = props;
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(
    async (prev: RegisterState, form: FormData | null) => (form ? registerForEvent(prev, form) : null),
    null,
  );
  const [, startTransition] = useTransition();
  const loginHref = `/login?next=${encodeURIComponent(`/events/${eventId}`)}`;

  function openSheet() {
    if (state) startTransition(() => dispatch(null));
    setOpen(true);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    // Dispatch manually so a failed submission keeps what the person typed.
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setOpen(true);
    startTransition(() => dispatch(form));
  }

  let left: ReactNode = null;
  let right: ReactNode = null;

  switch (cta.kind) {
    case "register": {
      left = <BarText title={props.priceLabel ?? "Tickets"} sub={props.availabilityLine} />;
      if (!signedIn) {
        right = <Link href={loginHref} className={ctaClass}>{cta.label}</Link>;
      } else if (cta.needsSheet) {
        right = <button type="button" onClick={openSheet} className={ctaClass}>{cta.label}</button>;
      } else {
        const ticketId = defaultTicketId(props.tickets);
        right = (
          <form onSubmit={submit} className="lg:w-full">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="ticketTypeId" value={ticketId ?? ""} />
            <button type="submit" disabled={pending} aria-busy={pending} className={ctaClass}>
              {pending ? "One moment…" : cta.label}
            </button>
          </form>
        );
      }
      break;
    }
    case "registered":
      left = (
        <div className="min-w-0">
          <RegistrationBadge status={cta.status} />
          <p className="mt-1 truncate text-xs text-muted">{STATUS_COPY[cta.status].title}</p>
        </div>
      );
      right = props.registrationId ? (
        <Link href={`/tickets/${props.registrationId}`} className={ctaClass}>
          <Icon name="ticket" /> {cta.status === "going" ? "View ticket" : "View status"}
        </Link>
      ) : null;
      break;
    case "external":
      left = <BarText title={props.priceLabel ?? "External registration"} sub="Registration on the organiser's site" />;
      right = (
        // Plain <a>: a prefetch must never count as an "Apply now" click.
        <a href={`/go/${eventId}`} target="_blank" rel="noopener" className={ctaClass}>
          {cta.label} <Icon name="external" />
        </a>
      );
      break;
    case "info":
      left = <BarText title="No registration needed" sub="Just turn up" icon="check" />;
      right = (
        <CalendarButton eventId={eventId} googleUrl={props.googleCalendarUrl} className={ctaClass}>
          <Icon name="calendar" /> Add to calendar
        </CalendarButton>
      );
      break;
    case "cancelled":
      left = <BarText title="This event has been cancelled" sub="Registration is closed" icon="x" tone="danger" />;
      break;
    case "ended":
      left = <BarText title="This event has ended" sub={cta.registrationStatus === "going" ? "Thanks for coming" : null} icon="clock" />;
      if (cta.registrationStatus && props.registrationId) {
        right = <ButtonLink href={`/tickets/${props.registrationId}`} variant="secondary" size="lg">View ticket</ButtonLink>;
      }
      break;
    case "closed":
      left = <BarText title="Registration has closed" sub={props.priceLabel} icon="clock" />;
      break;
    case "sold_out":
      left = <BarText title="Sold out" sub="There's no waitlist for this event" icon="ticket" tone="danger" />;
      break;
    case "declined":
      left = <BarText title="Not accepted" sub="The organiser didn't accept your registration" icon="info" tone="danger" />;
      break;
    case "preview":
      left = <BarText title="Preview" sub="Registration opens once the event is published" icon="info" />;
      break;
    default:
      left = <BarText title="Not open for registration" sub={null} icon="info" />;
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:pointer-events-auto lg:static lg:z-auto lg:p-0">
        <div className="glass-strong pointer-events-auto mx-auto max-w-md rounded-[26px] p-2 pl-4 lg:max-w-none lg:p-5">
          <div className="flex min-h-12 items-center gap-3 lg:flex-col lg:items-stretch lg:gap-4">
            <div className="min-w-0 flex-1 lg:flex-none">{left}</div>
            {right && <div className="flex shrink-0 lg:w-full">{right}</div>}
          </div>
        </div>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="register-title"
        title={
          state?.ok ? null : (
            <div>
              <h2 id="register-title" className="text-lg font-semibold leading-tight tracking-tight">
                {props.requiresApproval ? "Request to join" : "Get tickets"}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted">{props.eventTitle} · {props.dateLabel}</p>
            </div>
          )
        }
      >
        {state?.ok ? (
          <RegisterResult state={state} onDone={() => setOpen(false)} onboarded={props.onboarded} />
        ) : (
          <RegisterForm {...props} state={state} pending={pending} onSubmit={submit} />
        )}
      </Sheet>
    </>
  );
}

function BarText({ title, sub, icon, tone }: { title: string; sub?: string | null; icon?: IconName; tone?: "danger" }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {icon && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${tone === "danger" ? "bg-red-500/10 text-red-300" : "bg-white/[0.07] text-muted"}`}>
          <Icon name={icon} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold tracking-tight">{title}</p>
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Form ──────────────────────────────────────────────────────────────────

function RegisterForm(props: Props & { state: RegisterState; pending: boolean; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  const { tickets, questions, state, pending } = props;
  const [ticketId, setTicketId] = useState(() => defaultTicketId(tickets));
  const selected = tickets.find((t) => t.id === ticketId) ?? null;
  const availability = selected ? ticketAvailability(selected) : "sales_ended";
  const full = availability === "sold_out";
  const blocked = !selected || availability === "sales_ended" || (full && !props.waitlistEnabled);
  const variant = registerVariant({ requiresApproval: props.requiresApproval, price: selected?.price ?? 0, full });
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form onSubmit={props.onSubmit} noValidate className="space-y-6 pb-4">
      <input type="hidden" name="eventId" value={props.eventId} />
      <input type="hidden" name="ticketTypeId" value={ticketId ?? ""} />

      {tickets.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2.5 font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-subtle">Ticket</legend>
          {tickets.map((t) => {
            const avail = ticketAvailability(t);
            const on = t.id === ticketId;
            const disabled = avail === "sales_ended" || (avail === "sold_out" && !props.waitlistEnabled);
            return (
              <label
                key={t.id}
                className={`relative flex cursor-pointer items-center gap-3 rounded-[20px] p-4 transition duration-200 motion-reduce:transition-none ${
                  on ? "border-gradient glow" : "border border-white/10 bg-white/[0.045] hover:bg-white/[0.08]"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="ticket-choice"
                  value={t.id}
                  checked={on}
                  disabled={disabled}
                  onChange={() => setTicketId(t.id)}
                  className="sr-only"
                />
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-white/20"}`} aria-hidden>
                  {on && <span className="bg-gradient h-2.5 w-2.5 rounded-full" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.name}</span>
                  {t.description && <span className="mt-0.5 block text-xs text-muted">{t.description}</span>}
                  <TicketNote ticket={t} waitlist={props.waitlistEnabled} />
                </span>
                <span className="text-base font-semibold tabular-nums tracking-tight">{formatTicketPrice(t.price, t.currency)}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {questions.length > 0 && (
        <fieldset className="space-y-5">
          <legend className="mb-3 font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-subtle">
            {props.requiresApproval ? "Your application" : "A few questions"}
          </legend>
          {questions.map((q) => (
            <QuestionField key={q.id} question={q} error={fieldErrors[q.id]} />
          ))}
        </fieldset>
      )}

      {state && !state.ok && (
        <div role="alert" className="flex items-start gap-2 rounded-[14px] border border-red-400/25 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {state.error}
            {state.signIn && (
              <>
                {" "}
                <Link className="font-semibold underline" href={`/login?next=${encodeURIComponent(`/events/${props.eventId}`)}`}>Sign in</Link>
              </>
            )}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <button type="submit" disabled={pending || blocked} aria-busy={pending} className={buttonClass({ size: "lg", full: true, className: "" })}>
          {pending ? "One moment…" : blocked ? (full ? "Sold out" : "Not available") : registerLabel(variant, selected?.price ?? 0, selected?.currency)}
        </button>
        <p className="text-center text-xs text-muted">
          {variant === "waitlist"
            ? "This ticket is full. Join the waitlist and you'll move up automatically if a place opens."
            : variant === "approval"
              ? "The organiser reviews every request. You'll get your ticket once approved."
              : variant === "paid"
                ? "You'll pay securely on the next step."
                : "Your QR ticket appears in My Tickets straight away."}
        </p>
      </div>
    </form>
  );
}

function TicketNote({ ticket, waitlist }: { ticket: TicketOption; waitlist: boolean }) {
  const avail = ticketAvailability(ticket);
  if (avail === "sales_ended") return <span className="mt-1 block text-xs text-muted">Sales ended</span>;
  if (avail === "sold_out") {
    return <span className="mt-1 block text-xs font-medium text-orange">Sold out{waitlist ? " · waitlist open" : ""}</span>;
  }
  if (ticket.remaining !== null && ticket.remaining <= 10) {
    return <span className="mt-1 block text-xs font-medium text-orange">Only {ticket.remaining} left</span>;
  }
  return null;
}

function QuestionField({ question: q, error }: { question: Question; error?: string }) {
  const name = answerField(q.id);
  const id = `field-${q.id}`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;
  const label = (
    <>
      {q.label}
      {q.required ? <span className="ml-0.5 text-orange" aria-hidden>*</span> : <span className="ml-1.5 text-xs font-normal text-muted">Optional</span>}
    </>
  );
  const errorText = error && <p id={errorId} className="mt-1.5 text-xs text-red-300">{error}</p>;

  if (q.kind === "checkbox") {
    return (
      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-white/10 bg-white/[0.045] p-4 transition-colors hover:bg-white/[0.08]">
          <input type="checkbox" name={name} aria-invalid={!!error} aria-describedby={describedBy} aria-required={q.required}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#a99bff]" />
          <span className="text-sm">{label}</span>
        </label>
        {errorText}
      </div>
    );
  }

  if (q.kind === "single_select" || q.kind === "multi_select") {
    const multi = q.kind === "multi_select";
    return (
      <fieldset aria-invalid={!!error} aria-describedby={describedBy}>
        <legend className="mb-2 text-sm font-medium text-fg/90">
          {label}
          {multi && <span className="ml-1.5 text-xs font-normal text-muted">Choose any</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <label key={opt} className="cursor-pointer">
              <input type={multi ? "checkbox" : "radio"} name={name} value={opt} required={!multi && q.required} className="peer sr-only" />
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.045] px-3.5 py-1.5 text-sm text-muted transition duration-200 hover:bg-white/[0.08] peer-checked:border-transparent peer-checked:bg-gradient peer-checked:font-medium peer-checked:text-bg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {opt}
              </span>
            </label>
          ))}
        </div>
        {errorText}
      </fieldset>
    );
  }

  const Control = q.kind === "long_text" ? "textarea" : "input";
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg/90">{label}</label>
      <Control
        id={id}
        name={name}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        aria-required={q.required}
        maxLength={q.kind === "long_text" ? 4000 : 300}
        rows={q.kind === "long_text" ? 4 : undefined}
        className={`${inputClass} ${q.kind === "long_text" ? "min-h-28" : ""}`}
      />
      {errorText}
    </div>
  );
}

// ─── Result ────────────────────────────────────────────────────────────────

const RESULT_ICON: Record<RegistrationStatus, IconName> = {
  going: "check",
  pending: "hourglass",
  waitlisted: "users",
  awaiting_payment: "card",
  declined: "info",
  cancelled: "info",
};

function RegisterResult({ state, onDone, onboarded }: { state: Extract<RegisterState, { ok: true }>; onDone: () => void; onboarded: boolean }) {
  const copy = STATUS_COPY[state.status];
  const going = state.status === "going";
  const title =
    going ? "You're going!" : state.status === "pending" ? "Request sent" : state.status === "awaiting_payment" ? "Your place is held" : copy.title;
  const body =
    going
      ? "Your QR ticket is ready in My Tickets. Show it at the door."
      : state.status === "pending"
        ? "Request sent — the organiser will review it. We'll let you know when they decide."
        : copy.body;

  return (
    <div className="flex flex-col items-center pb-6 text-center" role="status" aria-live="polite">
      <div className="relative mb-5 mt-2">
        <div className="bg-gradient absolute inset-0 rounded-full opacity-25 blur-2xl" aria-hidden />
        <div className={`relative flex h-20 w-20 items-center justify-center rounded-full ${going ? "bg-gradient text-bg" : "border-gradient text-fg"}`}>
          <Icon name={RESULT_ICON[state.status]} className="h-9 w-9" strokeWidth={2.2} />
        </div>
      </div>
      <h2 id="register-title" className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-xs text-sm text-muted">{body}</p>

      {state.paymentError && (
        <p role="alert" className="mt-4 w-full rounded-[14px] border border-orange/25 bg-orange/10 px-3.5 py-3 text-sm text-orange">
          {state.paymentError}
        </p>
      )}

      {!onboarded && <SetupNudge next={`/tickets/${state.registrationId}`} className="mt-5 w-full text-left" />}

      <div className="mt-6 grid w-full gap-2">
        {state.status === "awaiting_payment" && !state.paymentError && <CompletePaymentButton registrationId={state.registrationId} />}
        <Link href={`/tickets/${state.registrationId}`} className={buttonClass({ size: "lg", full: true, variant: going ? "primary" : "secondary" })}>
          <Icon name="ticket" /> {going ? "View ticket" : "View in My Tickets"}
        </Link>
        <button type="button" onClick={onDone} className={buttonClass({ size: "lg", full: true, variant: "ghost" })}>
          Done
        </button>
      </div>
    </div>
  );
}
