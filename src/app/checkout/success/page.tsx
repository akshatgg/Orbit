import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import type Stripe from "stripe";
import { CheckoutMessage, CheckoutSuccess } from "@/components/payments/CheckoutResult";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth";
import { formatEventDate, formatPrice } from "@/lib/format";
import { fulfilCheckoutSession } from "@/lib/payments/fulfil";
import { checkoutOutcome } from "@/lib/payments/logic";
import { getStripe } from "@/lib/payments/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

type SearchParams = PageProps<"/checkout/success">["searchParams"];

export default function Page({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-16 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="flex justify-center py-4">
        <Image src="/brand/orbit-mark.png" alt="ORBIT" width={40} height={40} />
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

type RegistrationRow = {
  id: string;
  event_id: string;
  status: string;
  payment_status: string;
  ticket_types: { name: string } | null;
  events: { id: string; title: string; starts_at: string; venue_name: string | null; format: string } | null;
};

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { session_id } = await searchParams;
  const sessionId = Array.isArray(session_id) ? session_id[0] : session_id;

  const stripe = getStripe();
  if (!stripe) {
    return (
      <CheckoutMessage title="Paid tickets aren't available yet" tone="neutral" action={<ButtonLink href="/">Back to ORBIT</ButtonLink>}>
        ORBIT isn&apos;t taking payments right now, so there&apos;s nothing to confirm.
      </CheckoutMessage>
    );
  }

  let session: Stripe.Checkout.Session | null = null;
  if (sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    session = await stripe.checkout.sessions.retrieve(sessionId).catch((error) => {
      console.error("[payments] couldn't load checkout session", sessionId, error);
      return null;
    });
  }
  if (!session) {
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

  const outcome = checkoutOutcome(session);
  const eventId = session.metadata?.event_id;
  const eventHref = eventId ? `/events/${eventId}` : "/";

  // Don't make people wait for the webhook: confirm the ticket now (idempotent).
  if (outcome === "paid") {
    await fulfilCheckoutSession(session).catch((error) => console.error("[payments] fulfil on success page failed", error));
  }

  const supabase = await createClient();
  const registrationId = session.metadata?.registration_id;
  const { data } = registrationId
    ? await supabase
        .from("registrations")
        .select("id, event_id, status, payment_status, ticket_types(name), events(id, title, starts_at, venue_name, format)")
        .eq("id", registrationId)
        .maybeSingle()
    : { data: null };
  const reg = data as unknown as RegistrationRow | null; // RLS: only the buyer (or the organiser) sees it

  if (outcome === "paid") {
    const paid = session.amount_total != null ? formatPrice(session.amount_total / 100, session.amount_total / 100, "GBP") : null;
    return (
      <CheckoutSuccess
        eventTitle={reg?.events?.title ?? "Your event"}
        when={reg?.events ? formatEventDate(reg.events.starts_at) : null}
        where={reg?.events ? (reg.events.format === "online" ? "Online" : reg.events.venue_name) : null}
        ticketName={reg?.ticket_types?.name ?? null}
        amount={paid}
        ticketHref={reg ? `/tickets/${reg.id}` : "/tickets"}
        eventHref={eventHref}
        email={session.customer_details?.email ?? session.customer_email ?? null}
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
            {session.url && (
              <a href={session.url} className={buttonClass({ size: "lg", full: true })}>
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
