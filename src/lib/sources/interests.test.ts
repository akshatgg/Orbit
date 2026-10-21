import { describe, expect, it } from "vitest";
import { ALL_INTERESTS, interestTags } from "@/lib/taxonomy";
import { INTEREST_KEYWORDS, MAX_INTERESTS, inferInterests, withInterests } from "./interests";

describe("inferInterests", () => {
  // Real titles from imported Meetup events.
  it.each([
    ["Bangalore Startup & Entrepreneurs Network", ["entrepreneurship"]],
    ["Product Growth Meetup in Mumbai", ["product"]],
    ["TradFi & Bitcoin Club", ["finance"]],
    ["Book Club {Online} Meet", ["arts"]],
    ["Bowling & Other Activities", ["socialising"]],
    ["Join a vibrant mix of talents and pros for a FREE lively Friends Circle Night!", ["socialising"]],
    ["My Gardening Journey (And Yours!): Let’s Chat About Plants & Growth", ["wellbeing"]],
  ])("%s", (title, expected) => {
    expect(inferInterests({ title })).toEqual(expected);
  });

  it("reads tags, so a source's 'social' tag means socialising", () => {
    expect(inferInterests({ title: "Thursday meetup", tags: ["social"] })).toEqual(["socialising"]);
  });

  it("ignores a couple of passing mentions in the description", () => {
    expect(inferInterests({ title: "Monthly meetup", description: "Drinks will be provided." })).toEqual([]);
    expect(inferInterests({ title: "Multi-Agent AI", description: "We serve healthcare and clinical teams." })).toEqual(["technology"]);
    expect(inferInterests({ title: "Monthly meetup", description: "Drinks, dinner and a wine tasting." })).toEqual(["food"]);
    expect(inferInterests({ title: "Sunday Book Club", summary: "An adventure through books." })).toEqual(["arts"]);
  });

  it("matches whole words only", () => {
    expect(inferInterests({ title: "Lawn games and a raid on the pantry" })).toEqual([]);
  });

  it("keeps the strongest few", () => {
    const busy = { title: "Tech startup founders: AI, fintech, climate, design, yoga, coffee, music and board games" };
    expect(inferInterests(busy)).toHaveLength(MAX_INTERESTS);
    expect(inferInterests(busy)[0]).toBe("technology");
  });
});

describe("withInterests", () => {
  it("adds missing interests after the existing tags and never removes any", () => {
    expect(withInterests({ title: "Startup founders mixer", tags: ["carrer", "entrepreneurship"] })).toEqual([
      "carrer", "entrepreneurship", "socialising",
    ]);
  });

  it("is stable: a second pass adds nothing", () => {
    const once = withInterests({ title: "Sunday run club", tags: [] });
    expect(withInterests({ title: "Sunday run club", tags: once })).toEqual(once);
  });
});

describe("interest vocabulary", () => {
  it("has keywords for every interest people can pick", () => {
    expect(Object.keys(INTEREST_KEYWORDS).sort()).toEqual(ALL_INTERESTS.map((i) => i.value).sort());
  });

  it("expands an interest to its synonym tags for the filter", () => {
    expect(interestTags("fitness")).toEqual(["fitness", "running", "sport", "sports"]);
    expect(interestTags("law")).toEqual(["law"]);
  });
});
