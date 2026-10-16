"use client";

import { Badge } from "@/components/ui/Badge";
import { EventCover } from "@/components/events/EventCover";
import { FORMAT_LABELS, formatEventDate, formatPrice } from "@/lib/format";
import type { EventForm } from "@/lib/organiser/event-form";
import { ticketPriceRange, usesTickets } from "@/lib/organiser/registration";
import type { EventIssue, StepId } from "@/lib/organiser/schemas";
import { londonLocalToUtcIso } from "@/lib/organiser/time";
import { StepIntro } from "./fields";

/** Same look as the event card guests see (EventCard itself is server-only because of its query helpers). */
export function PreviewCard({ form, organiser, stacked = false }: { form: EventForm; organiser: { name: string; is_verified: boolean }; stacked?: boolean }) {
  const start = londonLocalToUtcIso(form.starts_at);
  const prices = usesTickets(form.registration)
    ? ticketPriceRange(form.tickets.map((t) => Number(t.price || 0)))
    : (() => {
        const v = form.display_price.trim() === "" ? null : Number(form.display_price);
        return { price_min: v, price_max: v };
      })();
  const price = formatPrice(prices.price_min, prices.price_max);

  return (
    <article className="glass overflow-hidden rounded-[22px]">
      <div className={stacked ? "flex flex-col gap-3 p-3" : "flex gap-3 p-3"}>
        <div className={`shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 ${stacked ? "aspect-[16/10] w-full" : "h-24 w-24"}`}>
          <EventCover src={form.cover_url || null} title={form.title || "Your event"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-accent">{start ? formatEventDate(start) : "Date to be set"}</p>
          <h3 className="mt-0.5 line-clamp-2 font-semibold leading-snug">{form.title || "Untitled event"}</h3>
          <p className="mt-1 truncate text-xs text-muted">{organiser.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {price && <Badge tone={price === "Free" ? "success" : "neutral"}>{price}</Badge>}
            <Badge>{form.format === "in_person" ? form.venue_name || FORMAT_LABELS.in_person : FORMAT_LABELS[form.format]}</Badge>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ReviewStep({ form, organiser, issues, goTo, status }: {
  form: EventForm;
  organiser: { name: string; is_verified: boolean };
  issues: EventIssue[];
  goTo: (step: StepId) => void;
  status: string;
}) {
  const live = status === "published";
  return (
    <div className="space-y-5">
      <StepIntro title="Review & publish">
        {live ? "Check your changes, then save. Guests are told if the time or place changes." : "Here's how your event will look in the feed."}
      </StepIntro>
      <PreviewCard form={form} organiser={organiser} />

      {issues.length > 0 ? (
        <div role="alert" className="space-y-2 rounded-[20px] border border-orange/25 bg-orange/10 p-4">
          <p className="text-sm font-semibold text-orange">{live || status === "draft" ? "Fix these before publishing" : "Fix these"}</p>
          <ul className="space-y-1.5 text-sm">
            {issues.map((i, n) => (
              <li key={`${i.path}-${n}`}>
                <button type="button" onClick={() => goTo(i.step)} className="text-left text-fg underline decoration-orange/50 underline-offset-2 hover:decoration-orange">
                  {i.message}
                </button>
              </li>
            ))}
          </ul>
          {!live && <p className="text-xs text-muted">You can still save as a draft.</p>}
        </div>
      ) : (
        <p className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          Everything looks good{live ? "." : ", ready to publish."}
        </p>
      )}

      <dl className="glass divide-y divide-white/[0.07] rounded-[22px] text-sm">
        {[
          ["Registration", { tickets: "Free / paid tickets", application: "Application form", external: "External link", none: "Info only" }[form.registration]],
          ["Tickets", usesTickets(form.registration) ? `${form.tickets.length} type${form.tickets.length === 1 ? "" : "s"}` : "n/a"],
          ["Questions", usesTickets(form.registration) ? String(form.questions.length) : "n/a"],
          ["Capacity", usesTickets(form.registration) ? form.capacity || "Unlimited" : "n/a"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
