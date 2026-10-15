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
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-64 w-64 rounded-full bg-gradient opacity-25 blur-3xl" />

      <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient p-[3px] glow">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-bg">
          <span className="text-gradient font-display text-4xl font-bold" aria-hidden>
            ✓
          </span>
        </div>
      </div>

      <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-muted">Payment confirmed</p>
      <h1 className="relative mt-2 font-display text-3xl font-semibold">
        <span className="text-gradient">You&apos;re in!</span>
      </h1>

      <div className="border-gradient glow relative mt-6 space-y-3 rounded-2xl p-5 text-left">
        <p className="font-display text-lg font-semibold leading-snug">{eventTitle}</p>
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
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

const tones = {
  neutral: "border-line text-muted",
  info: "border-blue/40 text-blue",
  warning: "border-orange/40 text-orange",
  danger: "border-red-500/40 text-red-300",
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
    <section className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center" data-testid="checkout-message">
      <span
        aria-hidden
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border bg-surface-2 font-display text-xl font-bold ${tones[tone]}`}
      >
        {icons[tone]}
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
