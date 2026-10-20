import { describe, expect, it } from "vitest";
import { authoriseRefresh } from "./refresh-auth";

const SECRET = "s3cret-value";

describe("authoriseRefresh", () => {
  it("lets the Vercel cron in with the secret", () => {
    expect(authoriseRefresh({ method: "GET", authorization: `Bearer ${SECRET}`, cronSecret: SECRET })).toEqual({ ok: true, trigger: "cron" });
  });

  it("refuses GET without the right secret, or when no secret is configured", () => {
    expect(authoriseRefresh({ method: "GET", authorization: "Bearer wrong", cronSecret: SECRET })).toEqual({ ok: false, status: 401 });
    expect(authoriseRefresh({ method: "GET", authorization: null, cronSecret: SECRET })).toEqual({ ok: false, status: 401 });
    expect(authoriseRefresh({ method: "GET", authorization: "Bearer ", cronSecret: undefined })).toEqual({ ok: false, status: 401 });
  });

  it("lets a signed-in admin in from the same site", () => {
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "https://orbit.akshatgg.in", host: "orbit.akshatgg.in" })).toEqual({ ok: true, trigger: "manual" });
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "http://localhost:3000", host: "localhost:3000" })).toEqual({ ok: true, trigger: "manual" });
  });

  it("refuses admins from another site or without an origin", () => {
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "https://evil.example.com", host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 403 });
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: null, host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 403 });
    expect(authoriseRefresh({ method: "POST", isAdmin: true, origin: "garbage", host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 403 });
  });

  it("refuses non-admins and anonymous POSTs", () => {
    expect(authoriseRefresh({ method: "POST", isAdmin: false, origin: "https://orbit.akshatgg.in", host: "orbit.akshatgg.in" })).toEqual({ ok: false, status: 401 });
  });
});
