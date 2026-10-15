import { describe, expect, it } from "vitest";
import { categorySchema, slugify } from "./category";

describe("slugify", () => {
  it("makes url-safe slugs", () => {
    expect(slugify("Careers & Recruiting")).toBe("careers-and-recruiting");
    expect(slugify("  Hello,  World! ")).toBe("hello-world");
  });
});

describe("categorySchema", () => {
  it("normalises the slug and defaults sort order", () => {
    const r = categorySchema.parse({ name: " Pottery ", slug: "Pottery Club", group: "social", sort_order: "" });
    expect(r).toEqual({ name: "Pottery", slug: "pottery-club", group: "social", sort_order: 0 });
  });
  it("rejects bad input", () => {
    expect(categorySchema.safeParse({ name: "x", slug: "x", group: "nope", sort_order: 1.5 }).success).toBe(false);
  });
});
