import "server-only";
import webpush, { type WebPushError } from "web-push";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "./messages";
import type { RenderedEmail } from "./templates";
import { resolveEmailChannel, type SmtpConfig } from "./email-config";

// Channel senders: web push (VAPID) and email (SMTP or Resend). Server only — VAPID_PRIVATE_KEY,
// SMTP_PASS and RESEND_API_KEY never leave this file.

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function vapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { subject: process.env.VAPID_SUBJECT || "mailto:notifications@orbit.akshatgg.in", publicKey, privateKey };
}

export function isPushConfigured() {
  return vapid() !== null;
}

export function isEmailConfigured() {
  return resolveEmailChannel(process.env).kind !== "none";
}

export function channelsAvailable() {
  return { push: isPushConfigured(), email: isEmailConfigured() };
}

/** The JSON the service worker's push handler reads. */
export function pushPayload(message: Message) {
  return JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url,
    tag: message.tag,
    actions: message.actions ?? [],
  });
}

export type PushResult = { delivered: number; failed: number; expired: number };

/**
 * Sends one notification to every device a person has. Subscriptions the push service says are
 * gone (404/410) are deleted. Never throws.
 */
export async function sendPush(
  admin: SupabaseClient,
  subscriptions: StoredSubscription[],
  message: Message,
): Promise<PushResult> {
  const result: PushResult = { delivered: 0, failed: 0, expired: 0 };
  const details = vapid();
  if (!details) {
    console.warn("[notifications] push skipped: VAPID keys are not set");
    return { ...result, failed: subscriptions.length };
  }
  const payload = pushPayload(message);
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { vapidDetails: details, TTL: 60 * 60 * 12, urgency: "normal", timeout: 10_000 },
        );
        result.delivered++;
      } catch (err) {
        const status = (err as WebPushError).statusCode;
        if (status === 404 || status === 410) {
          result.expired++;
          const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          if (error) console.error("[notifications] couldn't delete expired subscription", error.message);
        } else {
          result.failed++;
          console.error("[notifications] push failed", status ?? "", (err as Error).message);
        }
      }
    }),
  );
  return result;
}

export function emailFrom() {
  const channel = resolveEmailChannel(process.env);
  return channel.kind === "none" ? process.env.EMAIL_FROM || "ORBIT <onboarding@resend.dev>" : channel.from;
}

export type EmailJob = { to: string; email: RenderedEmail };

let smtpTransport: { key: string; transporter: Transporter } | null = null;

function smtpTransporter(cfg: SmtpConfig) {
  const key = JSON.stringify(cfg);
  if (smtpTransport?.key !== key) {
    smtpTransport = {
      key,
      transporter: nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }
  return smtpTransport.transporter;
}

async function sendViaSmtp(cfg: SmtpConfig, from: string, jobs: EmailJob[]): Promise<boolean[]> {
  const ok = jobs.map(() => false);
  try {
    const transporter = smtpTransporter(cfg);
    for (let i = 0; i < jobs.length; i++) {
      try {
        await transporter.sendMail({
          from,
          to: jobs[i].to,
          subject: jobs[i].email.subject,
          html: jobs[i].email.html,
          text: jobs[i].email.text,
        });
        ok[i] = true;
      } catch (err) {
        console.error("[notifications] email failed", (err as Error).message);
      }
    }
  } catch (err) {
    console.error("[notifications] email failed", (err as Error).message);
  }
  return ok;
}

/**
 * Sends emails over SMTP when configured, otherwise through Resend's batch API (100 per
 * request, which also stays inside the free plan's rate limit). Returns, per job, whether it
 * was accepted. Never throws.
 */
export async function sendEmails(jobs: EmailJob[]): Promise<boolean[]> {
  const ok = jobs.map(() => false);
  if (jobs.length === 0) return ok;
  const channel = resolveEmailChannel(process.env);
  if (channel.kind === "none") {
    console.info(`[notifications] email skipped (no SMTP or RESEND_API_KEY set): ${jobs.length} message(s)`);
    return ok;
  }
  if (channel.kind === "smtp") return sendViaSmtp(channel.smtp, channel.from, jobs);
  const resend = new Resend(channel.apiKey);
  const from = channel.from;
  for (let i = 0; i < jobs.length; i += 100) {
    const chunk = jobs.slice(i, i + 100);
    try {
      const payload = chunk.map((j) => ({
        from,
        to: [j.to],
        subject: j.email.subject,
        html: j.email.html,
        text: j.email.text,
      }));
      const { error } = chunk.length === 1 ? await resend.emails.send(payload[0]) : await resend.batch.send(payload);
      if (error) {
        console.error("[notifications] email failed", error.name, error.message);
        continue;
      }
      chunk.forEach((_, k) => (ok[i + k] = true));
    } catch (err) {
      console.error("[notifications] email failed", (err as Error).message);
    }
    if (i + 100 < jobs.length) await new Promise((r) => setTimeout(r, 600));
  }
  return ok;
}
