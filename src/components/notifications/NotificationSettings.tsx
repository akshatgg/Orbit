"use client";

import { useCallback, useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { getNotificationPreferences, saveNotificationPreferences } from "@/lib/notifications/actions";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/notifications/plan";
import {
  currentSubscription,
  detectPushSupport,
  saveSubscription,
  sendTestPush,
  subscribeThisDevice,
  unsubscribeThisDevice,
  type PushSupport,
} from "./push-client";

type Notice = { tone: "ok" | "error" | "info"; text: string } | null;
type DeviceState = {
  support: PushSupport | "checking";
  permission: NotificationPermission | "unknown";
  subscribed: boolean;
};

/** Push + email reminder settings. Rendered on the profile page. */
export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [device, setDevice] = useState<DeviceState>({ support: "checking", permission: "unknown", subscribed: false });
  const [busy, setBusy] = useState<"on" | "off" | "test" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [, startTransition] = useTransition();

  const checkDevice = useCallback(async () => {
    const support = detectPushSupport();
    if (support !== "supported") {
      setDevice({ support, permission: "unknown", subscribed: false });
      return;
    }
    const sub = await currentSubscription().catch(() => null);
    setDevice({ support, permission: Notification.permission, subscribed: Boolean(sub) });
    // Keep the server copy fresh (it may have been cleared after an expiry).
    if (sub && Notification.permission === "granted") saveSubscription(sub).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getNotificationPreferences();
      if (cancelled) return;
      if (res.ok) setPrefs(res.data);
      setLoaded(true);
      await checkDevice();
    })();
    return () => {
      cancelled = true;
    };
  }, [checkDevice]);

  function update(patch: Partial<Preferences>) {
    const before = prefs;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setNotice(null);
    startTransition(async () => {
      const res = await saveNotificationPreferences(next);
      if (!res.ok) {
        setPrefs(before);
        setNotice({ tone: "error", text: res.error });
      }
    });
  }

  async function turnOn() {
    setBusy("on");
    setNotice(null);
    try {
      const permission = await subscribeThisDevice();
      if (permission === "granted") {
        if (!prefs.push_enabled) update({ push_enabled: true });
        setNotice({ tone: "ok", text: "Push is on for this device." });
      } else if (permission === "denied") {
        setNotice({ tone: "error", text: "Notifications are blocked. Allow them in your browser settings, then try again." });
      }
      await checkDevice();
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message || "Couldn't turn on push. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function turnOff() {
    setBusy("off");
    setNotice(null);
    try {
      await unsubscribeThisDevice();
      setNotice({ tone: "info", text: "Push is off for this device." });
      await checkDevice();
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setNotice(null);
    try {
      await sendTestPush();
      setNotice({ tone: "ok", text: "Test sent. It should pop up in a moment." });
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="notif-heading"
      className="glass mx-4 rounded-[22px] p-4"
      aria-busy={!loaded}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.07] text-accent">
          <BellIcon />
        </span>
        <div className="min-w-0">
          <h2 id="notif-heading" className="text-base font-semibold tracking-tight text-fg">Reminders</h2>
          <p className="text-sm text-muted">Never miss events you&apos;ve saved or booked.</p>
        </div>
      </div>

      <DevicePush device={device} busy={busy} onOn={turnOn} onOff={turnOff} onTest={test} />

      <div className="mt-4 divide-y divide-white/[0.07] border-t border-white/[0.07]">
        <Toggle
          label="Push reminders"
          hint="On every device where push is turned on"
          checked={prefs.push_enabled}
          disabled={!loaded}
          onChange={(v) => update({ push_enabled: v })}
        />
        <Toggle
          label="Email reminders"
          hint="To the email you signed in with"
          checked={prefs.email_enabled}
          disabled={!loaded}
          onChange={(v) => update({ email_enabled: v })}
        />
        <Toggle
          label="Deadline reminders"
          hint="When registration is about to close for events you saved"
          checked={prefs.deadline_reminders}
          disabled={!loaded}
          onChange={(v) => update({ deadline_reminders: v })}
        />
      </div>

      <div className="border-t border-white/[0.07] pt-3">
        <p id="notif-timing" className="text-sm font-medium text-fg">Remind me before events</p>
        <div role="radiogroup" aria-labelledby="notif-timing" className="mt-2 flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {([
            [24, "Day before"],
            [2, "On the day"],
          ] as const).map(([hours, label]) => {
            const on = prefs.remind_before_hours === hours;
            return (
              <button
                key={hours}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!loaded}
                onClick={() => !on && update({ remind_before_hours: hours })}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                  on ? "bg-gradient text-bg" : "text-muted hover:text-fg"
                }`}
              >
                {label}
                <span className={`ml-1 text-xs ${on ? "text-bg/70" : "text-muted/70"}`}>{hours}h</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted">Reminders go out each morning, as close to your choice as we can.</p>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mt-3 text-sm ${
            notice.tone === "error" ? "text-red-300" : notice.tone === "ok" ? "text-emerald-300" : "text-muted"
          }`}
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}

function DevicePush({ device, busy, onOn, onOff, onTest }: {
  device: DeviceState;
  busy: "on" | "off" | "test" | null;
  onOn: () => void;
  onOff: () => void;
  onTest: () => void;
}) {
  const btn =
    "inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  let status: string;
  let hint: ReactNode = null;
  let action: ReactNode = null;

  switch (device.support) {
    case "checking":
      status = "Checking this device…";
      break;
    case "ios-install":
      status = "Add ORBIT to your Home Screen";
      hint = (
        <>
          On iPhone, push works once ORBIT is installed (iOS 16.4+): tap <span className="text-fg">Share</span>, then{" "}
          <span className="text-fg">Add to Home Screen</span>, and open it from there.
        </>
      );
      break;
    case "ios-update":
      status = "Update iOS for push";
      hint = "Push notifications need iOS 16.4 or later. You'll still get email reminders.";
      break;
    case "unsupported":
      status = "Push isn't available in this browser";
      hint = "You'll still get email reminders.";
      break;
    case "not-configured":
      status = "Push isn't set up yet";
      hint = "You'll still get email reminders.";
      break;
    default:
      if (device.permission === "denied") {
        status = "Notifications are blocked";
        hint = "Allow notifications for ORBIT in your browser or system settings, then reload.";
      } else if (device.subscribed) {
        status = "Push is on for this device";
        action = (
          <div className="flex shrink-0 gap-1.5">
            <button type="button" onClick={onTest} disabled={busy !== null} className={`${btn} border border-white/10 bg-white/[0.07] text-fg hover:bg-white/[0.12]`}>
              {busy === "test" ? "Sending…" : "Send test"}
            </button>
            <button type="button" onClick={onOff} disabled={busy !== null} className={`${btn} text-muted hover:text-fg`}>
              {busy === "off" ? "Turning off…" : "Turn off"}
            </button>
          </div>
        );
      } else {
        status = "Get push notifications here";
        action = (
          <button type="button" onClick={onOn} disabled={busy !== null} className={`${btn} shrink-0 bg-gradient text-bg hover:brightness-110`}>
            {busy === "on" ? "Turning on…" : "Turn on"}
          </button>
        );
      }
  }

  const on = device.support === "supported" && device.subscribed && device.permission !== "denied";
  return (
    <div className="mt-4 rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-emerald-400" : "bg-muted/50"}`} />
          <p className="text-sm font-medium text-fg">{status}</p>
        </div>
        {action}
      </div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium text-fg">{label}</p>
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          checked ? "border-transparent bg-gradient" : "border-white/10 bg-white/[0.08]"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-4.5 w-4.5 rounded-full shadow transition-transform ${
            checked ? "translate-x-[22px] bg-bg" : "translate-x-[3px] bg-muted"
          }`}
        />
      </button>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
