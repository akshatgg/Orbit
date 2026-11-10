"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/Switch";
import {
  runPastEventCleanup,
  setPastEventCleanup,
  type PastEventCleanupSetting,
} from "@/app/admin/events/actions";
import { ActionButton } from "./ActionButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { toast } from "./Toaster";

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
});

const plural = (n: number, word: string) => `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`;

/**
 * Admin → Events: the nightly past-event cleanup. The switch decides whether the cron deletes
 * events dated before today (London) every night; "Delete now" runs the same cleanup at once.
 * Both remove the events' Cloudinary covers too.
 */
export function PastEventCleanup({ setting }: { setting: PastEventCleanupSetting }) {
  const [enabled, setEnabled] = useState(setting.enabled);
  const [confirmOn, setConfirmOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(on: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setPastEventCleanup(on).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (result.ok) {
        setEnabled(on);
        setConfirmOn(false);
        toast(result.message ?? "Saved");
      } else if (confirmOn) {
        setError(result.error);
      } else {
        toast(result.error, "error");
      }
    });
  }

  const last = setting.last_run;
  const consequences = (
    <>
      Every event that ended before today is permanently deleted with its tickets, registrations and
      saves, and its cover image is removed from Cloudinary. This can&rsquo;t be undone.
    </>
  );

  return (
    <section className="glass mb-5 flex flex-col gap-4 rounded-[20px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            disabled={pending}
            aria-label="Delete past events every night"
            onClick={() => (enabled ? save(false) : (setError(null), setConfirmOn(true)))}
          />
          <h2 className="text-sm font-semibold tracking-tight">Delete past events every night</h2>
        </div>
        <p className="text-xs text-muted">
          {plural(setting.pending, "past event")} waiting
          {last?.finished_at && (
            <> · last run {when.format(new Date(last.finished_at))} ({last.trigger === "cron" ? "nightly" : "manual"}):
              {" "}{plural(last.deleted ?? 0, "event")}, {plural(last.images ?? 0, "image")}
              {last.errors?.length ? <span className="text-red-300"> · stopped with an error</span> : null}
            </>
          )}
        </p>
      </div>

      <ActionButton
        action={() => runPastEventCleanup()}
        variant="danger"
        size="md"
        className="w-full sm:w-auto"
        confirm={{
          title: `Delete ${plural(setting.pending, "past event")} now?`,
          body: consequences,
          confirmLabel: "Delete now",
          danger: true,
        }}
      >
        Delete past events now
      </ActionButton>

      <ConfirmDialog
        open={confirmOn}
        options={{
          title: "Turn on the nightly cleanup?",
          body: <>Every night, when the scheduled cron calls the cleanup. {consequences}</>,
          confirmLabel: "Turn on",
          danger: true,
        }}
        pending={pending}
        error={error}
        onConfirm={() => save(true)}
        onClose={() => setConfirmOn(false)}
      />
    </section>
  );
}
