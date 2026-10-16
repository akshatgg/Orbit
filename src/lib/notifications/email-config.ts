// Which email channel to use, decided from environment variables. Pure (no network, no
// server-only import) so it can be unit-tested.

export type EmailEnv = Record<string, string | undefined>;

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

export type EmailChannel =
  | { kind: "smtp"; smtp: SmtpConfig; from: string }
  | { kind: "resend"; apiKey: string; from: string }
  | { kind: "none" };

const DEFAULT_SMTP_PORT = 465;

function clean(value: string | undefined) {
  const v = value?.trim();
  return v ? v : undefined;
}

export function smtpConfig(env: EmailEnv): SmtpConfig | null {
  const host = clean(env.SMTP_HOST);
  const user = clean(env.SMTP_USER);
  const pass = env.SMTP_PASS ? env.SMTP_PASS : undefined;
  if (!host || !user || !pass) return null;
  const parsed = Number.parseInt(clean(env.SMTP_PORT) ?? "", 10);
  const port = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_SMTP_PORT;
  // 465 is implicit TLS; anything else starts plain and upgrades with STARTTLS.
  return { host, port, secure: port === 465, user, pass };
}

export function resolveEmailChannel(env: EmailEnv): EmailChannel {
  const configuredFrom = clean(env.EMAIL_FROM);
  const smtp = smtpConfig(env);
  if (smtp) return { kind: "smtp", smtp, from: configuredFrom ?? `ORBIT <${smtp.user}>` };
  const apiKey = clean(env.RESEND_API_KEY);
  if (apiKey) return { kind: "resend", apiKey, from: configuredFrom ?? "ORBIT <onboarding@resend.dev>" };
  return { kind: "none" };
}
