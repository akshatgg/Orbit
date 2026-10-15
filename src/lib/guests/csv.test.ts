import { describe, expect, it } from "vitest";
import { buildGuestCsv, csvCell, csvDate, csvFilename, toCsv } from "./csv";
import type { Guest, GuestQuestion } from "./types";

describe("csvCell", () => {
  it("leaves plain text alone", () => {
    expect(csvCell("Sam Student")).toBe("Sam Student");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Smith, Jo")).toBe('"Smith, Jo"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+44 20 7946 0000")).toBe("'+44 20 7946 0000");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@sam")).toBe("'@sam");
  });
});

describe("toCsv", () => {
  it("joins with commas and CRLF", () => {
    expect(toCsv([["a", "b"], ["c,d", "e"]])).toBe('a,b\r\n"c,d",e\r\n');
  });
});

describe("csvDate", () => {
  it("formats in UK time", () => {
    expect(csvDate("2026-10-16T17:32:00Z")).toBe("2026-10-16 18:32"); // BST
    expect(csvDate("2026-12-01T09:05:00Z")).toBe("2026-12-01 09:05"); // GMT
    expect(csvDate(null)).toBe("");
  });
});

describe("csvFilename", () => {
  it("slugs the event title", () => {
    expect(csvFilename("Case Interview Bootcamp")).toBe("case-interview-bootcamp-guests.csv");
    expect(csvFilename("Café & Co: Q&A!")).toBe("cafe-co-q-a-guests.csv");
    expect(csvFilename("!!!")).toBe("event-guests.csv");
  });
});

describe("buildGuestCsv", () => {
  const questions: GuestQuestion[] = [
    { id: "q1", label: "Which programme?", kind: "single_select" },
    { id: "q2", label: "Why us, honestly?", kind: "long_text" },
    { id: "q3", label: "Topics", kind: "multi_select" },
  ];
  const guests: Guest[] = [
    {
      id: "r1", userId: "u1", name: "Grace Guest", email: "grace@example.com", status: "pending",
      ticket: "Insight Week place", registeredAt: "2026-10-16T08:00:00Z", checkedInAt: null,
      answers: { q1: "MSc Finance", q2: 'I love "markets",\nand people', q3: ["Markets", "Advisory"] },
    },
    {
      id: "r2", userId: "u2", name: null, email: "anon@example.com", status: "going",
      ticket: null, registeredAt: "2026-10-15T23:30:00Z", checkedInAt: "2026-10-16T18:00:00Z", answers: {},
    },
  ];

  it("writes a header with one column per question and escapes answers", () => {
    const csv = buildGuestCsv(guests, questions);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('Name,Email,Status,Ticket,Registered at,Checked in at,Which programme?,"Why us, honestly?",Topics');
    expect(lines[1]).toBe(
      'Grace Guest,grace@example.com,Pending,Insight Week place,2026-10-16 09:00,,MSc Finance,"I love ""markets"",\nand people","Markets, Advisory"',
    );
    expect(lines[2]).toBe(",anon@example.com,Going,,2026-10-16 00:30,2026-10-16 19:00,,,");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("works with no questions and no guests", () => {
    expect(buildGuestCsv([], [])).toBe("Name,Email,Status,Ticket,Registered at,Checked in at\r\n");
  });
});
