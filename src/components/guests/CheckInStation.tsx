"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { checkInByCode, checkInRegistration, undoCheckIn } from "@/app/(main)/organiser/events/[id]/actions";
import { matchesQuery } from "@/lib/guests/filter";
import { createScanHandler, describeOutcome, type ResultView, type ScanOutcome } from "@/lib/guests/scan";
import type { Guest } from "@/lib/guests/types";
import { formatTimeRange } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";

type Counts = { going: number; checkedIn: number };
type CameraState = "starting" | "scanning" | "denied" | "unavailable" | "insecure" | "error";
type Shown = ResultView & { registrationId?: string; key: number };
export type DoorGuest = Pick<Guest, "id" | "name" | "email" | "ticket" | "status" | "checkedInAt">;

const VIBRATE: Record<ResultView["tone"], number[]> = { success: [70], warning: [60, 50, 60], danger: [220] };
const RESULT_MS = 6000;

export function CheckInStation({ eventId, counts: serverCounts, guests }: { eventId: string; counts: Counts; guests: DoorGuest[] }) {
  // Counts arrive with every scan; fresh server props (after revalidation) win when they change.
  const [counts, setCounts] = useState(serverCounts);
  const [prevServer, setPrevServer] = useState(serverCounts);
  if (prevServer.going !== serverCounts.going || prevServer.checkedIn !== serverCounts.checkedIn) {
    setPrevServer(serverCounts);
    setCounts(serverCounts);
  }

  const [camera, setCamera] = useState<CameraState>("starting");
  const [cameraTry, setCameraTry] = useState(0);
  const [shown, setShown] = useState<Shown | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showRef = useRef<(o: ScanOutcome) => void>(() => {});

  function show(outcome: ScanOutcome) {
    const view = describeOutcome(outcome);
    const registrationId = outcome.kind === "result" && outcome.result.result === "checked_in" ? outcome.result.registration_id : undefined;
    setShown({ ...view, registrationId, key: Date.now() });
    try {
      navigator.vibrate?.(VIBRATE[view.tone]);
    } catch {
      // Vibration is a nice-to-have.
    }
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setShown(null), RESULT_MS);
  }

  useEffect(() => {
    showRef.current = show;
  });

  async function checkIn(code: string) {
    const res = await checkInByCode(eventId, code);
    if (res.ok) setCounts(res.counts);
    return res;
  }

  // ─── Camera + QR decoding ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastDecode = 0;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const handler = createScanHandler({
      checkIn: (code) => checkInByCode(eventId, code).then((res) => {
        if (res.ok && !cancelled) setCounts(res.counts);
        return res;
      }),
      onOutcome: (o) => !cancelled && showRef.current(o),
    });

    function stop() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (video) video.srcObject = null;
    }

    async function start() {
      if (!window.isSecureContext) return setCamera("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return setCamera("unavailable");
      try {
        const [media, { default: jsQR }] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
          import("jsqr"),
        ]);
        if (cancelled || !video) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        video.srcObject = media;
        await video.play().catch(() => {});
        if (cancelled) return stop();
        setCamera("scanning");

        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          if (!ctx || video.readyState < video.HAVE_CURRENT_DATA || handler.busy || now - lastDecode < 90) return;
          lastDecode = now;
          const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.round(video.videoWidth * scale);
          const h = Math.round(video.videoHeight * scale);
          if (!w || !h) return;
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const qr = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (qr?.data) void handler.handle(qr.data);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name;
        setCamera(
          name === "NotAllowedError" || name === "SecurityError" ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError" ? "unavailable"
          : "error",
        );
      }
    }

    // Save battery: let go of the camera while the screen is hidden.
    function onVisibility() {
      if (document.hidden) stop();
      else if (!stream) void start();
    }

    void start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [eventId, cameraTry]);

  useEffect(() => () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
  }, []);

  const pct = counts.going ? Math.min(100, Math.round((counts.checkedIn / counts.going) * 100)) : 0;

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:space-y-0">
      <div className="space-y-5">
      {/* Live counter */}
      <section aria-label="Check-in progress" className="px-4">
        <div className="flex items-end justify-between gap-3">
          <p aria-live="polite" className="tabular-nums">
            <span className="text-fg text-4xl font-semibold tracking-tight">{counts.checkedIn}</span>
            <span className="text-xl font-medium text-subtle"> / {counts.going}</span>
            <span className="ml-2 text-sm font-medium text-muted">checked in</span>
          </p>
          <span className="pb-1 text-sm tabular-nums text-muted">{pct}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
          <div className="bg-gradient h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {/* Scanner */}
      <section aria-label="Ticket scanner" className="px-4">
        <div data-theme="dark" className="relative mx-auto aspect-[3/4] max-h-[62dvh] w-full overflow-hidden rounded-[28px] bg-black text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.12),0_0_0_6px_rgb(255_255_255/0.04),0_24px_60px_-20px_rgb(0_0_0/0.9)]">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Camera preview"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity ${camera === "scanning" ? "opacity-100" : "opacity-0"}`}
          />
          {camera === "scanning" ? <Viewfinder /> : <CameraMessage state={camera} onRetry={() => { setCamera("starting"); setCameraTry((n) => n + 1); }} />}
          {shown && <ResultCard key={shown.key} view={shown} eventId={eventId} onCounts={setCounts} onDismiss={() => setShown(null)} />}
          {!shown && camera === "scanning" && (
            <p className="absolute inset-x-0 bottom-4 text-center text-sm font-medium text-fg/80 [text-shadow:0_1px_8px_rgb(0_0_0/0.8)]">
              Point at a ticket QR code
            </p>
          )}
        </div>
      </section>

      </div>

      <div className="space-y-5">
        <ManualEntry checkIn={checkIn} onOutcome={show} />
        <GuestFinder eventId={eventId} guests={guests} onOutcome={show} onCounts={setCounts} />
      </div>
    </div>
  );
}

function Viewfinder() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <style>{`@keyframes orbit-scan{0%{top:18%}50%{top:76%}100%{top:18%}}@keyframes orbit-bracket{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}@media (prefers-reduced-motion:reduce){.orbit-bracket,.orbit-scanline{animation:none!important}}`}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,rgb(0_0_0/0.55)_72%)]" />
      <div className="absolute left-1/2 top-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2">
        {["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[22px] origin-top-left", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[22px] origin-top-right",
          "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-[22px] origin-bottom-left", "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-[22px] origin-bottom-right"].map((c) => (
          <span key={c} className={`orbit-bracket absolute h-11 w-11 border-white/90 ${c}`} style={{ animation: "orbit-bracket 2.8s ease-in-out infinite" }} />
        ))}
      </div>
      <div
        className="orbit-scanline absolute left-[18%] h-px w-[64%] rounded-full bg-gradient-to-r from-transparent via-white to-transparent opacity-70 shadow-[0_0_14px_rgb(169_155_255/0.8)]"
        style={{ animation: "orbit-scan 2.6s ease-in-out infinite" }}
      />
    </div>
  );
}

const CAMERA_COPY: Record<Exclude<CameraState, "scanning">, { title: string; body: string; retry: boolean }> = {
  starting: { title: "Starting camera…", body: "Allow camera access when your browser asks.", retry: false },
  denied: {
    title: "Camera access is blocked",
    body: "Allow the camera for this site in your browser settings, then try again. You can still check guests in below.",
    retry: true,
  },
  unavailable: { title: "No camera available", body: "We couldn't find a camera (or another app is using it). Use the ticket code or guest list below.", retry: true },
  insecure: { title: "Camera needs a secure connection", body: "Open ORBIT over HTTPS to scan tickets. The ticket code and guest list below still work.", retry: false },
  error: { title: "Camera didn't start", body: "Something went wrong opening the camera. Try again, or check guests in below.", retry: true },
};

function CameraMessage({ state, onRetry }: { state: Exclude<CameraState, "scanning">; onRetry: () => void }) {
  const copy = CAMERA_COPY[state];
  return (
    <div role={state === "starting" ? "status" : "alert"} className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <span className={`flex h-14 w-14 items-center justify-center glass rounded-2xl ${state === "starting" ? "animate-pulse motion-reduce:animate-none" : ""}`} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <circle cx="12" cy="13" r="3.5" />
          {state !== "starting" && <path d="M4 4l16 16" />}
        </svg>
      </span>
      <p className="text-base font-semibold tracking-tight">{copy.title}</p>
      <p className="max-w-xs text-sm text-muted">{copy.body}</p>
      {copy.retry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

const TONE: Record<ResultView["tone"], { card: string; icon: string; ring: string }> = {
  success: { card: "border-emerald-300/25 bg-emerald-950/60", icon: "bg-emerald-300/90 text-emerald-950", ring: "shadow-[0_18px_40px_-16px_rgb(16_185_129/0.45)]" },
  warning: { card: "border-orange/25 bg-orange/[0.12]", icon: "bg-orange/90 text-bg", ring: "shadow-[0_18px_40px_-16px_rgb(253_181_112/0.35)]" },
  danger: { card: "border-red-300/25 bg-red-950/60", icon: "bg-red-300/90 text-red-950", ring: "shadow-[0_18px_40px_-16px_rgb(248_113_113/0.4)]" },
};

function ResultCard({ view, eventId, onCounts, onDismiss }: {
  view: Shown; eventId: string; onCounts: (c: Counts) => void; onDismiss: () => void;
}) {
  const [pending, start] = useTransition();
  const [undone, setUndone] = useState(false);
  const t = TONE[view.tone];
  return (
    <div
      role="alert"
      className={`absolute inset-x-3 bottom-3 rounded-[22px] border p-4 backdrop-blur-2xl backdrop-saturate-150 ${t.card} ${t.ring}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-semibold ${t.icon}`} aria-hidden>
          {view.tone === "success" ? "✓" : view.tone === "warning" ? "!" : "✕"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight tracking-tight">{undone ? "Check-in undone" : view.title}</p>
          {view.name && <p className="mt-0.5 truncate text-base font-semibold">{view.name}</p>}
          {view.detail && <p className="mt-0.5 text-sm text-fg/75">{view.detail}</p>}
        </div>
        <button type="button" onClick={onDismiss} className="-m-1 rounded-full p-1.5 text-fg/60 transition-colors hover:text-fg" aria-label="Dismiss">✕</button>
      </div>
      {view.registrationId && !undone && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => start(async () => {
              const res = await undoCheckIn(eventId, view.registrationId!);
              if (res.ok) {
                setUndone(true);
                onCounts(res.counts);
              }
            })}
          >
            {pending ? "Undoing…" : "Undo"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ManualEntry({ checkIn, onOutcome }: {
  checkIn: (code: string) => ReturnType<typeof checkInByCode>;
  onOutcome: (o: ScanOutcome) => void;
}) {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="manual-entry" className="glass mx-4 rounded-[22px] p-4">
      <h2 id="manual-entry" className="text-sm font-semibold tracking-tight">Enter a ticket code</h2>
      <p className="mt-0.5 text-xs text-muted">The code printed under the guest&apos;s QR ticket.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = code.trim();
          if (!value) return;
          start(async () => {
            try {
              const res = await checkIn(value);
              onOutcome(res.ok ? { kind: "result", code: value, result: res.result } : { kind: "error", code: value, message: res.error });
              if (res.ok) setCode("");
            } catch {
              onOutcome({ kind: "error", code: value, message: "Couldn't reach ORBIT. Check your connection." });
            }
          });
        }}
      >
        <label htmlFor="ticket-code" className="sr-only">Ticket code</label>
        <input
          id="ticket-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. f92d92a48cf6…"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
        <Button type="submit" disabled={pending || !code.trim()} className="shrink-0">{pending ? "Checking…" : "Check in"}</Button>
      </form>
    </section>
  );
}

function GuestFinder({ eventId, guests, onOutcome, onCounts }: {
  eventId: string; guests: DoorGuest[]; onOutcome: (o: ScanOutcome) => void; onCounts: (c: Counts) => void;
}) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const matches = guests.filter((g) => matchesQuery(g, query));
    // Confirmed guests not yet in first, then those already in, then everyone else.
    const rank = (g: DoorGuest) => (g.status !== "going" ? 2 : g.checkedInAt ? 1 : 0);
    return matches.sort((a, b) => rank(a) - rank(b) || (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""));
  }, [guests, query]);
  const visible = query ? list : list.slice(0, 50);

  return (
    <section aria-labelledby="find-guest" className="glass mx-4 rounded-[22px] p-4">
      <h2 id="find-guest" className="text-sm font-semibold tracking-tight">Find a guest</h2>
      <p className="mt-0.5 text-xs text-muted">No ticket on them? Check them in by name.</p>
      <label htmlFor="guest-search" className="sr-only">Search guests by name or email</label>
      <input
        id="guest-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or email"
        className={`${inputClass} mt-3`}
      />
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{guests.length ? "No one matches that search." : "No guests yet."}</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/[0.07]">
          {visible.map((g) => (
            <FinderRow key={g.id} eventId={eventId} guest={g} onOutcome={onOutcome} onCounts={onCounts} />
          ))}
        </ul>
      )}
      {!query && list.length > visible.length && (
        <p className="pt-2 text-center text-xs text-muted">Showing {visible.length} of {list.length}. Search to find others.</p>
      )}
    </section>
  );
}

function FinderRow({ eventId, guest, onOutcome, onCounts }: {
  eventId: string; guest: DoorGuest; onOutcome: (o: ScanOutcome) => void; onCounts: (c: Counts) => void;
}) {
  const [pending, start] = useTransition();
  const who = guest.name ?? guest.email ?? "guest";
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{guest.name ?? guest.email}</p>
        <p className="truncate text-xs text-muted">
          {guest.checkedInAt ? <span className="text-emerald-300">In at {formatTimeRange(guest.checkedInAt)}</span> : guest.ticket ?? guest.email}
        </p>
      </div>
      {guest.status !== "going" ? (
        <RegistrationBadge status={guest.status} />
      ) : guest.checkedInAt ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Undo check-in for ${who}`}
          onClick={() => start(async () => {
            const res = await undoCheckIn(eventId, guest.id);
            if (res.ok) onCounts(res.counts);
            else onOutcome({ kind: "error", code: "", message: res.error });
          })}
        >
          Undo
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          aria-label={`Check in ${who}`}
          onClick={() => start(async () => {
            const res = await checkInRegistration(eventId, guest.id);
            if (res.ok) {
              onCounts(res.counts);
              onOutcome({ kind: "result", code: "", result: res.result });
            } else onOutcome({ kind: "error", code: "", message: res.error });
          })}
        >
          {pending ? "…" : "Check in"}
        </Button>
      )}
    </li>
  );
}
