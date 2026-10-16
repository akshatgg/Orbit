"use client";

import { useMemo, useState, useTransition } from "react";
import { approveAllPending, checkInRegistration, decideRegistration, undoCheckIn } from "@/app/(main)/organiser/events/[id]/actions";
import { labelledAnswers } from "@/lib/guests/answers";
import { filterGuests, type GuestFilter } from "@/lib/guests/filter";
import { countByStatus } from "@/lib/guests/stats";
import { REGISTRATION_STATUSES, STATUS_LABELS, type Guest, type GuestQuestion } from "@/lib/guests/types";
import { formatEventDate, formatTimeRange } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";

type Flash = { tone: "ok" | "error"; text: string } | null;

export function GuestList({ eventId, guests, questions, initialStatus }: {
  eventId: string;
  guests: Guest[];
  questions: GuestQuestion[];
  initialStatus: GuestFilter;
}) {
  const [status, setStatus] = useState<GuestFilter>(initialStatus);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [bulkPending, startBulk] = useTransition();

  const counts = useMemo(() => countByStatus(guests), [guests]);
  const checkedIn = useMemo(() => guests.filter((g) => g.status === "going" && g.checkedInAt).length, [guests]);
  const shown = useMemo(() => filterGuests(guests, { status, query }), [guests, status, query]);

  type Tab = { value: GuestFilter; label: string; count: number };
  const tabs = ([
    { value: "all", label: "All", count: guests.length },
    ...REGISTRATION_STATUSES.map((s) => ({ value: s as GuestFilter, label: STATUS_LABELS[s], count: counts[s] })),
    { value: "checked_in", label: "Checked in", count: checkedIn },
  ] as Tab[]).filter((t) => t.count > 0 || t.value === "all" || t.value === "going" || t.value === status);

  function approveAll() {
    if (!window.confirm(`Approve all ${counts.pending} pending ${counts.pending === 1 ? "person" : "people"}?`)) return;
    startBulk(async () => {
      const res = await approveAllPending(eventId);
      setFlash(res.ok ? { tone: "ok", text: `Approved ${res.approved} ${res.approved === 1 ? "person" : "people"}.` } : { tone: "error", text: res.error });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 px-4 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search guests by name or email</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className={`${inputClass} pl-10`}
          />
        </label>
        {counts.pending > 0 && (
          <Button onClick={approveAll} disabled={bulkPending} className="shrink-0">
            {bulkPending ? "Approving…" : `Approve all pending (${counts.pending})`}
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Filter by status" className="scrollbar-none flex gap-1.5 overflow-x-auto px-4">
        {tabs.map((t) => {
          const on = t.value === status;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setStatus(t.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition duration-200 active:scale-[0.97] motion-reduce:transition-none ${
                on ? "border-transparent bg-gradient font-medium text-bg" : "border-ink/10 bg-ink/[0.045] text-muted hover:border-ink/20 hover:bg-ink/[0.08] hover:text-fg"
              }`}
            >
              {t.label}
              <span className={`tabular-nums text-xs ${on ? "text-bg/70" : "text-subtle"}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <p role="status" aria-live="polite" className={`min-h-5 px-4 text-sm ${flash?.tone === "error" ? "text-red-300" : "text-emerald-300"}`}>
        {flash?.text}
      </p>

      {shown.length === 0 ? (
        <div className="mx-4 rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-10 text-center">
          <p className="font-semibold tracking-tight">{guests.length === 0 ? "No registrations yet" : "No guests match"}</p>
          <p className="mt-1 text-sm text-muted">
            {guests.length === 0 ? "Share your event link — guests will appear here as they register." : "Try another status or search."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-2 px-4 md:hidden">
            {shown.map((g) => (
              <li key={g.id} className="glass rounded-[22px] p-3.5">
                <div className="flex items-start gap-3">
                  <Avatar name={g.name ?? g.email} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{g.name ?? "Unnamed guest"}</p>
                        <p className="truncate text-xs text-muted">{g.email}</p>
                      </div>
                      <RegistrationBadge status={g.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <dt className="text-muted">Ticket</dt><dd className="truncate text-right">{g.ticket ?? "—"}</dd>
                      <dt className="text-muted">Registered</dt><dd className="text-right">{formatEventDate(g.registeredAt)}</dd>
                      {g.checkedInAt && <><dt className="text-muted">Checked in</dt><dd className="text-right text-emerald-300">{formatEventDate(g.checkedInAt)}</dd></>}
                    </dl>
                    <Answers guest={g} questions={questions} />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <GuestActions eventId={eventId} guest={g} onFlash={setFlash} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden px-4 md:block">
            <table className="w-full table-fixed border-separate border-spacing-0 glass overflow-hidden rounded-[22px] text-sm">
              <caption className="sr-only">Guests ({shown.length})</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="w-[31%] border-b border-ink/[0.07] px-3 py-2.5 font-medium">Guest</th>
                  <th scope="col" className="w-[14%] border-b border-ink/[0.07] px-3 py-2.5 font-medium">Ticket</th>
                  <th scope="col" className="w-[17%] border-b border-ink/[0.07] px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="w-[14%] border-b border-ink/[0.07] px-3 py-2.5 font-medium">Registered</th>
                  <th scope="col" className="w-[24%] border-b border-ink/[0.07] px-3 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <tr key={g.id} className="align-top transition-colors hover:bg-ink/[0.04]">
                    <td className="border-b border-ink/[0.07] px-3 py-3">
                      <div className="flex gap-2.5">
                        <Avatar name={g.name ?? g.email} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{g.name ?? "Unnamed guest"}</p>
                          <p className="truncate text-xs text-muted">{g.email}</p>
                          <Answers guest={g} questions={questions} />
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-ink/[0.07] px-3 py-3 text-xs">{g.ticket ?? <span className="text-muted">—</span>}</td>
                    <td className="border-b border-ink/[0.07] px-3 py-3">
                      <RegistrationBadge status={g.status} />
                      {g.checkedInAt && <p className="mt-1 text-xs text-emerald-300">In at {formatTimeRange(g.checkedInAt)}</p>}
                    </td>
                    <td className="border-b border-ink/[0.07] px-3 py-3 text-xs text-muted">{formatEventDate(g.registeredAt)}</td>
                    <td className="border-b border-ink/[0.07] px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <GuestActions eventId={eventId} guest={g} onFlash={setFlash} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Answers({ guest, questions }: { guest: Guest; questions: GuestQuestion[] }) {
  const rows = labelledAnswers(guest.answers, questions);
  if (rows.length === 0) return null;
  return (
    <details className="group mt-2 rounded-2xl border border-ink/[0.08] bg-ink/[0.04] text-xs [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-medium text-accent">
        Application answers ({rows.length})
        <span aria-hidden className="transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <dl className="space-y-2 border-t border-ink/[0.08] px-3 py-2.5">
        {rows.map((r) => (
          <div key={r.id}>
            <dt className="text-muted">{r.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words text-fg">{r.answer}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function GuestActions({ eventId, guest, onFlash }: { eventId: string; guest: Guest; onFlash: (f: Flash) => void }) {
  const [pending, start] = useTransition();
  const who = guest.name ?? guest.email ?? "Guest";

  function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    start(async () => {
      const res = await fn();
      onFlash(res.ok ? { tone: "ok", text: `${label}: ${who}` } : { tone: "error", text: res.error });
    });
  }

  const decide = (choice: "approve" | "decline") =>
    run(choice === "approve" ? "Approved" : "Declined", () => decideRegistration(eventId, guest.id, choice));

  const s = guest.status;
  return (
    <>
      {(s === "pending" || s === "waitlisted" || s === "declined") && (
        <Button size="sm" disabled={pending} onClick={() => decide("approve")} aria-label={`Approve ${who}`}>
          {s === "declined" ? "Approve anyway" : "Approve"}
        </Button>
      )}
      {(s === "pending" || s === "waitlisted") && (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => decide("decline")} aria-label={`Decline ${who}`}>
          Decline
        </Button>
      )}
      {s === "going" && !guest.checkedInAt && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("Checked in", () => checkInRegistration(eventId, guest.id))} aria-label={`Check in ${who}`}>
          Check in
        </Button>
      )}
      {s === "going" && guest.checkedInAt && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("Check-in undone", () => undoCheckIn(eventId, guest.id))} aria-label={`Undo check-in for ${who}`}>
          Undo check-in
        </Button>
      )}
      {pending && <span className="sr-only">Saving…</span>}
    </>
  );
}
