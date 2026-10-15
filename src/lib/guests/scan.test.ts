import { describe, expect, it, vi } from "vitest";
import { createScanHandler, describeOutcome, normaliseCode, ScanGate, type ScanOutcome } from "./scan";

const CODE = "f92d92a48cf665b22453c2fc";

describe("normaliseCode", () => {
  it("accepts ticket codes however they are typed", () => {
    expect(normaliseCode(CODE)).toBe(CODE);
    expect(normaliseCode(`  ${CODE.toUpperCase()} `)).toBe(CODE);
    expect(normaliseCode("f92d 92a4 8cf6-65b2-2453-c2fc")).toBe(CODE);
  });

  it("rejects things that aren't tickets", () => {
    expect(normaliseCode("")).toBeNull();
    expect(normaliseCode(null)).toBeNull();
    expect(normaliseCode("https://example.com")).toBeNull();
    expect(normaliseCode("abc123")).toBeNull();
  });
});

describe("ScanGate", () => {
  it("ignores the same code for 3 seconds", () => {
    const gate = new ScanGate(3000);
    expect(gate.accept("a", 0)).toBe(true);
    expect(gate.accept("a", 1000)).toBe(false);
    expect(gate.accept("a", 2999)).toBe(false);
    expect(gate.accept("a", 3000)).toBe(true);
  });

  it("lets a different code through straight away", () => {
    const gate = new ScanGate(3000);
    expect(gate.accept("a", 0)).toBe(true);
    expect(gate.accept("b", 10)).toBe(true);
    gate.reset();
    expect(gate.accept("a", 20)).toBe(true);
  });
});

describe("createScanHandler (decode → check-in flow)", () => {
  function setup(response: Parameters<typeof createScanHandler>[0]["checkIn"]) {
    let t = 0;
    const outcomes: ScanOutcome[] = [];
    const checkIn = vi.fn(response);
    const handler = createScanHandler({ checkIn, onOutcome: (o) => outcomes.push(o), now: () => t });
    return { handler, checkIn, outcomes, tick: (ms: number) => { t += ms; } };
  }

  it("checks a ticket in once while it stays in front of the camera", async () => {
    const { handler, checkIn, outcomes, tick } = setup(async () => ({ ok: true, result: { result: "checked_in", name: "Gabe" } }));
    expect(await handler.handle(CODE.toUpperCase())).toBe(true);
    tick(500);
    expect(await handler.handle(CODE)).toBe(false);
    tick(2600);
    expect(await handler.handle(CODE)).toBe(true);
    expect(checkIn).toHaveBeenCalledTimes(2);
    expect(checkIn).toHaveBeenCalledWith(CODE);
    expect(outcomes[0]).toEqual({ kind: "result", code: CODE, result: { result: "checked_in", name: "Gabe" } });
  });

  it("drops frames while a check-in is in flight", async () => {
    let release!: () => void;
    const { handler, checkIn } = setup(
      () => new Promise((resolve) => { release = () => resolve({ ok: true, result: { result: "checked_in" } }); }),
    );
    const first = handler.handle(CODE);
    expect(handler.busy).toBe(true);
    expect(await handler.handle("a".repeat(24))).toBe(false);
    release();
    await first;
    expect(handler.busy).toBe(false);
    expect(checkIn).toHaveBeenCalledTimes(1);
  });

  it("reports invalid codes without calling the server, once per window", async () => {
    const { handler, checkIn, outcomes } = setup(async () => ({ ok: true, result: { result: "checked_in" } }));
    await handler.handle("https://example.com");
    await handler.handle("https://example.com");
    expect(checkIn).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ kind: "invalid", raw: "https://example.com" }]);
  });

  it("turns action errors and network failures into error outcomes", async () => {
    const { handler, outcomes } = setup(async () => ({ ok: false, error: "Not allowed" }));
    await handler.handle(CODE);
    expect(outcomes[0]).toEqual({ kind: "error", code: CODE, message: "Not allowed" });

    const failing = setup(async () => { throw new Error("offline"); });
    await failing.handler.handle(CODE);
    expect(failing.outcomes[0].kind).toBe("error");
    expect(failing.handler.busy).toBe(false);
  });
});

describe("describeOutcome", () => {
  const result = (r: Extract<ScanOutcome, { kind: "result" }>["result"]): ScanOutcome => ({ kind: "result", code: CODE, result: r });

  it("green for a fresh check-in", () => {
    expect(describeOutcome(result({ result: "checked_in", name: "Gabe Guest", ticket: "General admission" }))).toEqual({
      tone: "success", title: "Checked in", name: "Gabe Guest", detail: "General admission",
    });
  });

  it("amber with the UK time for a repeat", () => {
    const view = describeOutcome(result({ result: "already", name: "Gabe", checked_in_at: "2026-10-16T17:32:00Z" }));
    expect(view.tone).toBe("warning");
    expect(view.title).toBe("Already checked in at 18:32");
  });

  it("red for unknown or unconfirmed tickets", () => {
    expect(describeOutcome(result({ result: "not_found" })).title).toBe("Ticket not found");
    const notGoing = describeOutcome(result({ result: "not_going", name: "Grace", status: "waitlisted" }));
    expect(notGoing).toMatchObject({ tone: "danger", title: "Not confirmed", name: "Grace" });
    expect(notGoing.detail).toContain("waitlisted");
    expect(describeOutcome({ kind: "invalid", raw: "x" }).tone).toBe("danger");
  });
});
