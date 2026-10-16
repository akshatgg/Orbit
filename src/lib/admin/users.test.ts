import { describe, expect, it } from "vitest";
import { describeUser, parseTypeFilter, typeFilterClause } from "./users";

describe("admin user filters", () => {
  it("parses the type filter defensively", () => {
    expect(parseTypeFilter("host")).toBe("host");
    expect(parseTypeFilter(["student", "x"])).toBe("student");
    expect(parseTypeFilter("admin; drop table")).toBe("");
    expect(parseTypeFilter(undefined)).toBe("");
  });

  it("builds clauses that count older accounts by university", () => {
    expect(typeFilterClause("student")).toContain("university.not.is.null");
    expect(typeFilterClause("other")).toContain("university.is.null");
    expect(typeFilterClause("graduate")).toBe("user_type.eq.graduate");
    expect(typeFilterClause("host")).toBeNull();
    expect(typeFilterClause("")).toBeNull();
  });

  it("describes a user's type and goals", () => {
    expect(describeUser({ user_type: "professional", goals: ["network", "host"] })).toMatchObject({
      type: "professional", typeLabel: "Working professional", isHost: true, goalLabels: ["Network"],
    });
    expect(describeUser({ user_type: null, university: "Imperial College London", goals: [] })).toMatchObject({ type: "student", isHost: false });
  });
});
