import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./auth-redirect";

const origin = "https://orbit.akshatgg.in";

describe("sanitizeNext", () => {
  it("defaults to /", () => {
    expect(sanitizeNext(null, origin)).toBe("/");
    expect(sanitizeNext(undefined, origin)).toBe("/");
    expect(sanitizeNext("", origin)).toBe("/");
  });

  it("keeps relative paths with query", () => {
    expect(sanitizeNext("/events", origin)).toBe("/events");
    expect(sanitizeNext("/events?id=3", origin)).toBe("/events?id=3");
  });

  it("rejects protocol-relative, backslash and non-path values", () => {
    expect(sanitizeNext("//evil.com", origin)).toBe("/");
    expect(sanitizeNext("/\\evil.com", origin)).toBe("/");
    expect(sanitizeNext("evil.com", origin)).toBe("/");
    expect(sanitizeNext("javascript:alert(1)", origin)).toBe("/");
  });

  it("reduces same-origin absolute URLs to path + search", () => {
    expect(sanitizeNext("https://orbit.akshatgg.in/events?x=1", origin)).toBe("/events?x=1");
  });

  it("rejects other origins", () => {
    expect(sanitizeNext("https://evil.com/events", origin)).toBe("/");
    expect(sanitizeNext("http://orbit.akshatgg.in/events", origin)).toBe("/");
    expect(sanitizeNext("https://orbit.akshatgg.in.evil.com/", origin)).toBe("/");
  });

  it("unwraps the auth callback URL", () => {
    expect(sanitizeNext("https://orbit.akshatgg.in/auth/callback?next=%2F", origin)).toBe("/");
    expect(sanitizeNext("https://orbit.akshatgg.in/auth/callback?next=%2Fevents", origin)).toBe("/events");
    expect(sanitizeNext("https://orbit.akshatgg.in/auth/callback", origin)).toBe("/");
    expect(sanitizeNext("/auth/callback?next=/profile", origin)).toBe("/profile");
  });

  it("does not follow unsafe or looping callback next values", () => {
    expect(sanitizeNext("https://orbit.akshatgg.in/auth/callback?next=//evil.com", origin)).toBe("/");
    expect(sanitizeNext("https://orbit.akshatgg.in/auth/callback?next=https://evil.com", origin)).toBe("/");
    expect(sanitizeNext("/auth/callback?next=/auth/callback?next=/x", origin)).toBe("/");
  });
});
