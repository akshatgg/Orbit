import { describe, expect, it } from "vitest";
import { categoryTerms, classifyEvent, type ClassifyCategory } from "./classify";

const CATEGORIES: ClassifyCategory[] = [
  { id: "1", name: "Technology", keywords: ["software", "developer", "ai", "cloud", "cyber"] },
  { id: "2", name: "Careers fair", keywords: ["careers fair"] },
  { id: "3", name: "Talk & panel", keywords: ["talk", "panel", "speaker", "keynote"] },
  { id: "4", name: "Fitness & sport", keywords: ["run", "running", "yoga", "climb", "hike"] },
  { id: "5", name: "Networking", keywords: ["networking", "mixer"] },
  { id: "6", name: "Competition", keywords: ["competition", "hackathon", "case competition"] },
];

const event = (title: string, extra: Partial<Parameters<typeof classifyEvent>[0]> = {}) => ({
  title,
  summary: null,
  description: null,
  tags: [],
  ...extra,
});

describe("categoryTerms", () => {
  it("includes the category's own name words minus stopwords", () => {
    expect(categoryTerms({ id: "x", name: "Talk & panel", keywords: ["keynote"] }))
      .toEqual(["keynote", "talk", "panel"]);
  });

  it("drops one- and two-letter words and duplicates", () => {
    const terms = categoryTerms({ id: "x", name: "Arts & culture", keywords: ["arts", "Culture"] });
    expect(terms).toEqual(["arts", "culture"]);
  });
});

describe("classifyEvent", () => {
  it("assigns a clear title match", () => {
    const r = classifyEvent(event("Software Architects Meetup"), CATEGORIES);
    expect(r.categoryId).toBe("1");
    expect(r.reason).toBe("matched");
    expect(r.matched).toContain("software");
  });

  it("matches whole words only — running does not hit run", () => {
    const noRun = classifyEvent(event("Morning running club"), CATEGORIES, { minScore: 3, margin: 2 });
    // "running" is its own keyword here, so it still matches; check the boundary rule directly.
    expect(noRun.categoryId).toBe("4");

    const other = classifyEvent(event("Runs the show"), [{ id: "f", name: "Fitness & sport", keywords: ["run"] }]);
    expect(other.categoryId).toBeNull();
    expect(other.reason).toBe("no-match");
  });

  it("scores multi-word keywords higher", () => {
    const r = classifyEvent(event("Case competition finals"), CATEGORIES);
    expect(r.categoryId).toBe("6");
    expect(r.score).toBe(6);
  });

  it("uses tags to confirm a weak title match", () => {
    const r = classifyEvent(event("Panel", { tags: ["speaker"] }), CATEGORIES);
    expect(r.categoryId).toBe("3");
    expect(r.score).toBe(5);
    expect(r.matched).toEqual(["panel", "speaker"]);
  });

  it("does not let prose alone decide", () => {
    const r = classifyEvent(event("Autumn gathering", { description: "A friendly mixer for new members" }), CATEGORIES);
    expect(r.categoryId).toBeNull();
    expect(r.reason).toBe("no-match");
  });

  it("refuses to guess when two categories tie", () => {
    const r = classifyEvent(event("Yoga and cloud computing"), CATEGORIES);
    expect(r.categoryId).toBeNull();
    expect(r.reason).toBe("ambiguous");
    expect(r.score).toBe(3);
  });

  it("refuses to guess when the runner-up is too close", () => {
    const close: ClassifyCategory[] = [
      { id: "a", name: "Careers fair" },
      { id: "b", name: "Beta", keywords: ["careers", "fair"] },
    ];
    const r = classifyEvent(event("Careers fair 2026"), close);
    expect(r.categoryId).toBeNull();
    expect(r.reason).toBe("ambiguous");
    expect(r.score).toBe(6);
  });

  it("returns no-match for an unrelated listing", () => {
    const r = classifyEvent(event("Board games evening"), CATEGORIES);
    expect(r.categoryId).toBeNull();
    expect(r.reason).toBe("no-match");
  });

  it("is stable when two categories would score the same", () => {
    const twins: ClassifyCategory[] = [
      { id: "b", name: "Beta", keywords: ["workshop"] },
      { id: "a", name: "Alpha", keywords: ["workshop"] },
    ];
    const r = classifyEvent(event("Workshop"), twins);
    // Same score, so it is ambiguous rather than order-dependent.
    expect(r.categoryId).toBeNull();
    expect(r.reason).toBe("ambiguous");
  });

  it("honours a custom threshold", () => {
    const r = classifyEvent(event("Yoga in the park"), CATEGORIES, { minScore: 6 });
    expect(r.categoryId).toBeNull();
    expect(r.reason).toBe("no-match");
  });

  it("copes with no categories", () => {
    expect(classifyEvent(event("Anything"), []).reason).toBe("no-match");
  });
});
