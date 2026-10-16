import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";

/** The "You're in!" confirmation after a paid checkout. */
export function CheckoutSuccess({
  eventTitle,
  when,
  where,
  ticketName,
  amount,
  ticketHref,
  eventHref,
  email,
}: {
  eventTitle: string;
  when: string | null;
  where: string | null;
  ticketName: string | null;
  amount: string | null;
  ticketHref: string;
  eventHref: string;
  email: string | null;
}) {
  return (
    <section className="relative mt-4 text-center" data-testid="checkout-success">
      {/* soft iridescent halo */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-64 w-64 rounded-full bg-accent opacity-20 blur-3xl" />

      <div className="border-gradient glow relative mx-auto flex h-24 w-24 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-fg" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>

      <p className="relative mt-6 font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-subtle">Payment confirmed</p>
      <h1 className="relative mt-2 text-3xl font-semibold tracking-tight">
        <span className="text-gradient">You&apos;re in!</span>
      </h1>

      <div className="border-gradient relative mt-6 space-y-3 rounded-[24px] p-5 text-left">
        <p className="text-lg font-semibold leading-snug tracking-tight">{eventTitle}</p>
        <dl className="space-y-1.5 text-sm">
          {when && <Row label="When">{when}</Row>}
          {where && <Row label="Where">{where}</Row>}
          {ticketName && <Row label="Ticket">{ticketName}</Row>}
          {amount && <Row label="Paid">{amount}</Row>}
        </dl>
        {email && <p className="text-xs text-muted">Stripe has emailed your receipt to {email}.</p>}
      </div>

      <div className="relative mt-6 space-y-2">
        <ButtonLink href={ticketHref} size="lg" full>
          View ticket
        </ButtonLink>
        <ButtonLink href={eventHref} variant="secondary" size="lg" full>
          Event details
        </ButtonLink>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

const tones = {
  neutral: "border-white/12 text-muted",
  info: "border-blue/30 text-blue",
  warning: "border-orange/30 text-orange",
  danger: "border-red-400/30 text-red-300",
} as const;

const icons = { neutral: "i", info: "…", warning: "!", danger: "×" } as const;

/** Non-success outcomes: processing, unfinished, expired, not found. */
export function CheckoutMessage({
  title,
  tone,
  children,
  action,
}: {
  title: string;
  tone: keyof typeof tones;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="glass mt-6 rounded-[24px] p-6 text-center" data-testid="checkout-message">
      <span
        aria-hidden
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border bg-white/[0.05] text-xl font-semibold ${tones[tone]}`}
      >
        {icons[tone]}
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
