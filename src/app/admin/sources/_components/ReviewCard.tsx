import { Badge } from "@/components/ui/Badge";
import { FORMAT_LABELS } from "@/lib/format";
import type { ReviewEvent, ReviewItem } from "@/lib/sources/queries";
import type { ActionState } from "../actions";
import { ActionButton } from "./ActionButton";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Side({ heading, event, label }: { heading: string; event: ReviewEvent | null; label: (s: string) => string }) {
  if (!event) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/12 bg-ink/[0.02] p-4 text-sm text-muted">
        <p className="text-xs font-medium text-muted">{heading}</p>
        <p className="mt-2">This event is no longer available.</p>
      </div>
    );
  }
  const url = event.source_url ?? event.external_url;
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-ink/[0.03] p-4 text-sm">
      <p className="text-xs font-medium text-muted">{heading}</p>
      <p className="text-base font-semibold tracking-tight">{event.title}</p>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-subtle">Starts</dt><dd>{when(event.starts_at)}</dd>
        {event.ends_at && (<><dt className="text-subtle">Ends</dt><dd>{when(event.ends_at)}</dd></>)}
        <dt className="text-subtle">Where</dt>
        <dd>{[event.venue_name, event.address].filter(Boolean).join(", ") || FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS] || event.format}</dd>
        <dt className="text-subtle">Organiser</dt><dd>{event.organiser?.name ?? "—"}</dd>
        <dt className="text-subtle">Source</dt><dd>{label(event.source)}</dd>
        <dt className="text-subtle">Status</dt><dd>{event.status}</dd>
        {url && (<><dt className="text-subtle">Link</dt><dd className="break-all"><a href={url} target="_blank" rel="noreferrer" className="text-accent transition-colors hover:underline">{url}</a></dd></>)}
      </dl>
      {(event.summary ?? event.description) && (
        <p className="line-clamp-3 text-xs text-muted">{event.summary ?? event.description}</p>
      )}
    </div>
  );
}

const REASONS = {
  duplicate: { tone: "warning", text: "Possible duplicate" },
  missing: { tone: "danger", text: "Missing from its feed" },
  flagged: { tone: "info", text: "Flagged for review" },
} as const;

export function ReviewCard({ item, label, resolve, resolved = false }: {
  item: ReviewItem;
  label: (source: string) => string;
  resolve: (state: ActionState, formData: FormData) => Promise<ActionState>;
  resolved?: boolean;
}) {
  const { event, original, reason } = item;
  const r = REASONS[reason];
  return (
    <article className="glass space-y-4 rounded-[20px] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={resolved ? "neutral" : r.tone}>{resolved ? "Kept hidden" : r.text}</Badge>
        {reason === "missing" && (
          <span className="text-xs text-muted">The last successful refresh didn&rsquo;t include it. It is still live until you decide.</span>
        )}
      </div>
      <div className={`grid gap-4 ${reason === "duplicate" ? "md:grid-cols-2" : ""}`}>
        <Side heading={reason === "duplicate" ? "Flagged (hidden)" : "Event"} event={event} label={label} />
        {reason === "duplicate" && <Side heading="Kept (original)" event={original} label={label} />}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {reason === "duplicate" ? (
          <>
            <ActionButton
              action={resolve} fields={{ id: event.id, decision: "not_duplicate" }} variant="primary"
              confirm={{ title: "Not a duplicate?", body: "Both events will be listed, and this pair won't be flagged again.", confirmLabel: "Not a duplicate" }}
            >Not a duplicate</ActionButton>
            {!resolved && (
              <ActionButton
                action={resolve} fields={{ id: event.id, decision: "keep_hidden" }}
                confirm={{ title: "Keep this one hidden?", body: "It stays hidden as a duplicate of the other event.", confirmLabel: "Keep hidden" }}
              >Keep hidden</ActionButton>
            )}
          </>
        ) : (
          <ActionButton
            action={resolve} fields={{ id: event.id, decision: "reviewed" }}
            confirm={{ title: "Mark reviewed?", body: "It leaves the queue. The event stays as it is.", confirmLabel: "Mark reviewed" }}
          >Mark reviewed</ActionButton>
        )}
      </div>
    </article>
  );
}
