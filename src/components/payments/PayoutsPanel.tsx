import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ConnectState } from "@/lib/payments/logic";
import { PayoutActionForm, type PayoutActionState } from "./PayoutActionForm";

type Action = (prev: PayoutActionState, formData: FormData) => Promise<PayoutActionState>;

export type PayoutsPanelProps = {
  state: ConnectState;
  org: { id: string; name: string; status: string };
  feePercent: number;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  dueCount?: number;
  liveStatus: boolean; // false when Stripe couldn't be reached and we show our saved copy
  startSetup: Action;
  openDashboard: Action;
};

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient" />
      <span>{children}</span>
    </li>
  );
}

function feeLine(feePercent: number) {
  return feePercent > 0
    ? `ORBIT keeps ${feePercent}% of each ticket; Stripe's card fees also apply.`
    : "ORBIT takes no cut — only Stripe's standard card fees apply.";
}

/** The payouts card for one organiser, in whichever Stripe Connect stage it's at. */
export function PayoutsPanel(props: PayoutsPanelProps) {
  const { state, org } = props;
  const approved = org.status === "approved";

  if (state === "unconfigured") {
    return (
      <Card className="space-y-3" data-testid="payouts-unconfigured">
        <Badge>Not available yet</Badge>
        <h2 className="font-display text-lg font-semibold">Paid tickets are switched off on ORBIT</h2>
        <p className="text-sm text-muted">
          ORBIT hasn&apos;t been connected to Stripe yet, so nobody can sell paid tickets for now. Free tickets,
          application forms and Apply-now links all work as normal.
        </p>
        <p className="text-sm text-muted">
          As soon as payments are switched on, you&apos;ll be able to connect a payout account here and get paid
          straight to your bank.
        </p>
      </Card>
    );
  }

  if (state === "not_connected") {
    return (
      <div className="border-gradient glow space-y-4 rounded-2xl p-5" data-testid="payouts-not-connected">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Payouts</p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            Sell paid tickets for <span className="text-gradient">{org.name}</span>
          </h2>
        </div>
        <ul className="space-y-2 text-sm text-muted">
          <Point>Money from ticket sales goes straight to your own Stripe account, then to your bank.</Point>
          <Point>{feeLine(props.feePercent)}</Point>
          <Point>Setup takes about 5 minutes — have your bank details and ID handy.</Point>
        </ul>
        {!approved && (
          <p className="rounded-xl border border-orange/30 bg-orange/10 px-3 py-2 text-sm text-orange">
            You can set up payouts once ORBIT has approved {org.name}.
          </p>
        )}
        <PayoutActionForm action={props.startSetup} orgId={org.id} label="Set up payouts with Stripe" disabled={!approved} />
      </div>
    );
  }

  if (state === "incomplete") {
    const reviewing = props.detailsSubmitted && !props.dueCount;
    return (
      <Card className="space-y-4" data-testid="payouts-incomplete">
        <Badge tone="warning">{reviewing ? "Being reviewed" : "Setup not finished"}</Badge>
        <div>
          <h2 className="font-display text-lg font-semibold">
            {reviewing ? "Stripe is checking your details" : "Finish setting up payouts"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {reviewing
              ? "This usually takes a few minutes. Paid tickets go on sale as soon as Stripe gives the all-clear."
              : props.dueCount
                ? `Stripe still needs ${props.dueCount} more detail${props.dueCount === 1 ? "" : "s"} before you can take payments.`
                : "Stripe needs a few more details before you can take payments."}
          </p>
        </div>
        <PayoutActionForm
          action={props.startSetup}
          orgId={org.id}
          label={reviewing ? "Review details on Stripe" : "Continue setup"}
          variant={reviewing ? "secondary" : "primary"}
          disabled={!approved}
        />
        {!props.liveStatus && <StaleNote />}
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="payouts-connected">
      <div className="border-gradient glow space-y-4 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient text-lg font-bold text-bg">
            ✓
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">You can sell paid tickets</h2>
            <p className="text-sm text-muted">{org.name} is connected to Stripe.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">✓ Charges enabled</Badge>
          {props.payoutsEnabled === false ? (
            <Badge tone="warning">Payouts paused — check Stripe</Badge>
          ) : props.payoutsEnabled ? (
            <Badge tone="success">✓ Payouts enabled</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted">{feeLine(props.feePercent)}</p>
        <PayoutActionForm action={props.openDashboard} orgId={org.id} label="Open Stripe dashboard" variant="secondary" />
      </div>
      <p className="px-1 text-xs text-muted">
        Refunds (for example if you cancel an event) are made from your Stripe dashboard.
      </p>
      {!props.liveStatus && <StaleNote />}
    </div>
  );
}

function StaleNote() {
  return <p className="px-1 text-xs text-muted">We couldn&apos;t reach Stripe just now, so this status may be out of date.</p>;
}
