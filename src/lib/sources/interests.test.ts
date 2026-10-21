import { describe, expect, it } from "vitest";
import { ALL_INTERESTS, interestTags } from "@/lib/taxonomy";
import { HINT_WEIGHT, INTEREST_KEYWORDS, MAX_INTERESTS, inferInterests, withInterests } from "./interests";

describe("inferInterests", () => {
  // Real titles from imported Meetup events.
  it.each([
    ["Bangalore Startup & Entrepreneurs Network", ["entrepreneurship"]],
    ["Product Growth Meetup in Mumbai", ["product"]],
    ["TradFi & Bitcoin Club", ["finance", "crypto"]],
    ["Book Club {Online} Meet", ["books"]],
    ["Multi-Agent AI for Financial Research", ["technology", "ai", "finance"]],
    ["Your Resume, Your Power: Build a Career-Ready CV in 60 Minutes", ["careers"]],
    ["10% OFF! 6 Weeks to HIRED: The Fall 2026 Job Search Bootcamp", ["careers"]],
    ["1% Leadership Club {Online} Meet", ["growth"]],
    ["Business Networking & Referral Meetup ( 5 PM )", ["entrepreneurship"]],
    ["Export Import Business Strategy Online Meetup India", ["entrepreneurship"]],
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
    expect(inferInterests({ title: "Multi-Agent AI", description: "We serve healthcare and clinical teams." })).toEqual(["technology", "ai"]);
    expect(inferInterests({ title: "Monthly meetup", description: "Drinks, dinner and a wine tasting." })).toEqual(["food"]);
    expect(inferInterests({ title: "Sunday Book Club", summary: "An adventure through books." })).toEqual(["books"]);
  });

  it("matches whole words only", () => {
    expect(inferInterests({ title: "Lawn games and a raid on the pantry" })).toEqual([]);
    expect(inferInterests({ title: "Meet travel agents and estate agents" })).toEqual(["travel"]);
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

describe("platform hints", () => {
  const groupCategory = (label: string) => ({ label, weight: HINT_WEIGHT.groupCategory });
  const groupTopic = (label: string) => ({ label, weight: HINT_WEIGHT.groupTopic });

  it("a Luma category is enough on its own (Luma sets it from the event's content)", () => {
    expect(inferInterests({ title: "Embedded Swift: From Code to Hardware" }, [{ label: "Tech", weight: HINT_WEIGHT.eventCategory }])).toEqual(["technology"]);
    expect(inferInterests({ title: "Saturday session" }, [{ label: "AI", weight: HINT_WEIGHT.eventCategory }])).toEqual(["technology", "ai"]);
  });

  it("a Meetup group's category and topics add up for a vague title (real Mohali group)", () => {
    const hints = [groupCategory("Career & Business"), groupTopic("Business"), groupTopic("Entrepreneurship"), groupTopic("Small Business")];
    expect(inferInterests({ title: "So, what's your goal today?" }, hints)).toEqual(["entrepreneurship"]);
  });

  it("one group-wide topic alone isn't enough (a book club group that also lists Mentoring)", () => {
    const hints = [groupCategory("Hobbies & Passions"), groupTopic("Reading"), groupTopic("Mentoring"), groupTopic("Leadership Development")];
    expect(inferInterests({ title: "Book Club {Online} Meet" }, hints)).toEqual(["books"]);
  });

  it("withInterests passes hints through and still only adds", () => {
    expect(withInterests({ title: "Monthly meetup", tags: ["mine"] }, [{ label: "Climate", weight: HINT_WEIGHT.eventCategory }])).toEqual(["mine", "sustainability"]);
  });
});
