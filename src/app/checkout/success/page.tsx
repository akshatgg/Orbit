import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutMessage, CheckoutSuccess } from "@/components/payments/CheckoutResult";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth";
import { formatEventDate, formatPrice } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { apiErrorCode } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { OrbitLogo } from "@/components/brand/OrbitLogo";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

type SearchParams = PageProps<"/checkout/success">["searchParams"];

export default function Page({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-16 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="flex justify-center py-4">
        <OrbitLogo size={40} alt="ORBIT" />
      </div>
      <Suspense
        fallback={
          <div className="mt-6 space-y-4" aria-busy="true" aria-label="Confirming your payment">
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
            <Skeleton className="h-48 rounded-[24px]" />
          </div>
        }
      >
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** `GET /checkout/success`: what happened to the checkout, confirmed with Stripe by the API. */
type CheckoutReturn = {
  outcome: "paid" | "processing" | "open" | "expired" | "unknown";
  status: string | null;
  registration_id: string | null;
  event: { id: string; title: string; starts_at: string; venue_name: string | null; format: string } | null;
  ticket_type: { name: string } | null;
  amount_total: number | null;
  currency: string | null;
  buyer_email: string | null;
  checkout_url: string | null;
};

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { session_id } = await searchParams;
  const sessionId = Array.isArray(session_id) ? session_id[0] : session_id;

  let result: CheckoutReturn | null = null;
  if (sessionId) {
    try {
      // Paid sessions are confirmed now (idempotent), so nobody waits for the webhook.
      result = await authed.get<CheckoutReturn>("/checkout/success", { query: { session_id: sessionId } });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (apiErrorCode(error) === "payments_not_configured") {
        return (
          <CheckoutMessage title="Paid tickets aren't available yet" tone="neutral" action={<ButtonLink href="/">Back to ORBIT</ButtonLink>}>
            ORBIT isn&apos;t taking payments right now, so there&apos;s nothing to confirm.
          </CheckoutMessage>
        );
      }
      console.error("[payments] couldn't load checkout session", sessionId, error.status, error.message);
    }
  }
  if (!result || result.outcome === "unknown") {
    return (
      <CheckoutMessage
        title="We couldn't find that payment"
        tone="danger"
        action={<ButtonLink href="/tickets">Go to my tickets</ButtonLink>}
      >
        If you were charged, your ticket will appear in My Tickets within a few minutes.
      </CheckoutMessage>
    );
  }

  const { outcome, event } = result;
  const eventHref = event ? `/events/${event.id}` : "/";

  if (outcome === "paid") {
    const paid = result.amount_total != null
      ? formatPrice(result.amount_total / 100, result.amount_total / 100, result.currency ?? "GBP")
      : null;
    return (
      <CheckoutSuccess
        eventTitle={event?.title ?? "Your event"}
        when={event ? formatEventDate(event.starts_at) : null}
        where={event ? (event.format === "online" ? "Online" : event.venue_name) : null}
        ticketName={result.ticket_type?.name ?? null}
        amount={paid}
        ticketHref={result.registration_id ? `/tickets/${result.registration_id}` : "/tickets"}
        eventHref={eventHref}
        email={result.buyer_email}
      />
    );
  }

  if (outcome === "processing") {
    return (
      <CheckoutMessage
        title="Your payment is processing"
        tone="info"
        action={<ButtonLink href={eventHref}>Back to the event</ButtonLink>}
      >
        Your bank is still confirming the payment. We&apos;ll add your ticket to My Tickets as soon as it clears — you
        can close this page.
      </CheckoutMessage>
    );
  }

  if (outcome === "open") {
    return (
      <CheckoutMessage
        title="You haven't finished paying"
        tone="warning"
        action={
          <div className="space-y-2">
            {result.checkout_url && (
              <a href={result.checkout_url} className={buttonClass({ size: "lg", full: true })}>
                Return to checkout
              </a>
            )}
            <ButtonLink href={eventHref} variant="secondary" size="lg" full>
              Back to the event
            </ButtonLink>
          </div>
        }
      >
        Your spot is held for a little longer. Finish paying to get your ticket.
      </CheckoutMessage>
    );
  }

  return (
    <CheckoutMessage
      title="Your checkout expired"
      tone="warning"
      action={
        <ButtonLink href={eventHref} size="lg" full>
          Try again
        </ButtonLink>
      }
    >
      You weren&apos;t charged. We hold a spot for 30 minutes while you pay — head back to the event to get your ticket
      again.
    </CheckoutMessage>
  );
}
