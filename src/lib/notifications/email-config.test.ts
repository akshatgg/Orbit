import { describe, expect, it } from "vitest";
import { resolveEmailChannel, smtpConfig } from "./email-config";

const SMTP = { SMTP_HOST: "smtp.gmail.com", SMTP_USER: "me@gmail.com", SMTP_PASS: "app pass" };

describe("smtpConfig", () => {
  it("needs host, user and pass", () => {
    expect(smtpConfig({})).toBeNull();
    expect(smtpConfig({ ...SMTP, SMTP_PASS: "" })).toBeNull();
    expect(smtpConfig({ ...SMTP, SMTP_HOST: undefined })).toBeNull();
    expect(smtpConfig({ ...SMTP, SMTP_USER: " " })).toBeNull();
  });

  it("defaults to port 465 with implicit TLS", () => {
    expect(smtpConfig(SMTP)).toEqual({ host: "smtp.gmail.com", port: 465, secure: true, user: "me@gmail.com", pass: "app pass" });
  });

  it("uses STARTTLS on other ports", () => {
    expect(smtpConfig({ ...SMTP, SMTP_PORT: "587" })).toMatchObject({ port: 587, secure: false });
  });

  it("falls back to 465 for an invalid port", () => {
    expect(smtpConfig({ ...SMTP, SMTP_PORT: "abc" })).toMatchObject({ port: 465, secure: true });
    expect(smtpConfig({ ...SMTP, SMTP_PORT: "0" })).toMatchObject({ port: 465 });
  });
});

describe("resolveEmailChannel", () => {
  it("prefers SMTP over Resend", () => {
    const c = resolveEmailChannel({ ...SMTP, RESEND_API_KEY: "re_x" });
    expect(c.kind).toBe("smtp");
  });

  it("defaults the SMTP from-address to the SMTP user", () => {
    expect(resolveEmailChannel(SMTP)).toMatchObject({ kind: "smtp", from: "ORBIT <me@gmail.com>" });
  });

  it("honours EMAIL_FROM", () => {
    expect(resolveEmailChannel({ ...SMTP, EMAIL_FROM: "Hi <a@b.c>" })).toMatchObject({ from: "Hi <a@b.c>" });
  });

  it("uses Resend when SMTP is incomplete", () => {
    expect(resolveEmailChannel({ SMTP_HOST: "smtp.gmail.com", RESEND_API_KEY: "re_x" })).toEqual({
      kind: "resend",
      apiKey: "re_x",
      from: "ORBIT <onboarding@resend.dev>",
    });
  });

  it("is none when nothing is configured", () => {
    expect(resolveEmailChannel({})).toEqual({ kind: "none" });
  });
});
