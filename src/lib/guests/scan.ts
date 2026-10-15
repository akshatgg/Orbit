import { STATUS_LABELS, type CheckInResult } from "./types";

/**
 * A ticket's QR code holds the registration's `qr_code`: 24 lowercase hex characters.
 * Accepts what a scanner or a person types (spaces, dashes, upper case); returns null for
 * anything that can't be an ORBIT ticket.
 */
export function normaliseCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase().replace(/[\s-]+/g, "");
  return /^[0-9a-f]{16,64}$/.test(code) ? code : null;
}

/**
 * Remembers recent codes so a ticket held in front of the camera is only sent once.
 * The same code is ignored for `windowMs` after it was last accepted.
 */
export class ScanGate {
  private seen = new Map<string, number>();

  constructor(private windowMs = 3000) {}

  /** True when `code` should be processed now (and records it). */
  accept(code: string, now = Date.now()): boolean {
    const last = this.seen.get(code);
    if (last !== undefined && now - last < this.windowMs) return false;
    this.seen.set(code, now);
    // Forget old codes so a long night at the door doesn't grow the map forever.
    if (this.seen.size > 200) {
      for (const [c, t] of this.seen) if (now - t >= this.windowMs) this.seen.delete(c);
    }
    return true;
  }

  reset() {
    this.seen.clear();
  }
}

export type ScanOutcome =
  | { kind: "result"; code: string; result: CheckInResult }
  | { kind: "invalid"; raw: string }
  | { kind: "error"; code: string; message: string };

/**
 * The decode → check-in flow, without the camera. Feed it every decoded QR string:
 * it normalises, debounces (per code), skips while a request is in flight and reports
 * exactly one outcome per accepted scan.
 */
export function createScanHandler({ checkIn, onOutcome, windowMs = 3000, now = () => Date.now() }: {
  checkIn: (code: string) => Promise<{ ok: true; result: CheckInResult } | { ok: false; error: string }>;
  onOutcome: (outcome: ScanOutcome) => void;
  windowMs?: number;
  now?: () => number;
}) {
  const gate = new ScanGate(windowMs);
  let busy = false;

  return {
    get busy() {
      return busy;
    },
    reset: () => gate.reset(),
    /** Returns true when the scan was sent (or reported as invalid), false when ignored. */
    async handle(raw: string): Promise<boolean> {
      if (busy) return false;
      const code = normaliseCode(raw);
      if (!gate.accept(code ?? `invalid:${raw}`, now())) return false;
      if (!code) {
        onOutcome({ kind: "invalid", raw });
        return true;
      }
      busy = true;
      try {
        const res = await checkIn(code);
        onOutcome(res.ok ? { kind: "result", code, result: res.result } : { kind: "error", code, message: res.error });
      } catch {
        onOutcome({ kind: "error", code, message: "Couldn't reach ORBIT. Check your connection." });
      } finally {
        busy = false;
      }
      return true;
    },
  };
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export type ResultView = {
  tone: "success" | "warning" | "danger";
  title: string;
  name: string | null;
  detail: string | null;
};

/** What the door screen shows for a scan outcome. */
export function describeOutcome(outcome: ScanOutcome): ResultView {
  if (outcome.kind === "invalid") {
    return { tone: "danger", title: "Not an ORBIT ticket", name: null, detail: "This QR code isn't a ticket for this event." };
  }
  if (outcome.kind === "error") {
    return { tone: "danger", title: "Couldn't check in", name: null, detail: outcome.message };
  }
  const r = outcome.result;
  const name = r.name ?? null;
  switch (r.result) {
    case "checked_in":
      return { tone: "success", title: "Checked in", name, detail: r.ticket ?? null };
    case "already":
      return {
        tone: "warning",
        title: r.checked_in_at ? `Already checked in at ${timeFmt.format(new Date(r.checked_in_at))}` : "Already checked in",
        name,
        detail: r.ticket ?? null,
      };
    case "not_going":
      return {
        tone: "danger",
        title: "Not confirmed",
        name,
        detail: r.status ? `Their registration is ${STATUS_LABELS[r.status].toLowerCase()}.` : "This guest isn't confirmed.",
      };
    default:
      return { tone: "danger", title: "Ticket not found", name: null, detail: "No ticket for this event matches that code." };
  }
}
