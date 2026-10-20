import { describe, expect, it } from "vitest";
import { importedDetailsSchema } from "./details-schema";

const base = {
  id: "8f6b2a8e-1d3c-4b5a-9e7f-0a1b2c3d4e5f",
  image_url: "",
  cover_url: "",
  description: "",
  price_min: "",
  price_max: "",
};

describe("importedDetailsSchema", () => {
  it("turns empty fields into nulls", () => {
    expect(importedDetailsSchema.parse(base)).toEqual({
      id: base.id, image_url: null, cover_url: null, description: null, price_min: null, price_max: null,
    });
  });

  it("accepts https image links, text and prices", () => {
    const parsed = importedDetailsSchema.parse({
      ...base, image_url: "https://cdn.lu.ma/x.jpg", description: "  Hello  ", price_min: "0", price_max: "12.50",
    });
    expect(parsed).toMatchObject({ image_url: "https://cdn.lu.ma/x.jpg", description: "Hello", price_min: 0, price_max: 12.5 });
  });

  it.each([
    [{ image_url: "http://cdn.lu.ma/x.jpg" }, "Image links must start with https://"],
    [{ cover_url: "javascript:alert(1)" }, "Image links must start with https://"],
    [{ description: "x".repeat(5001) }, "Keep the description under 5,000 characters"],
    [{ price_min: "-1" }, "Prices can't be negative"],
    [{ price_min: "abc" }, "Prices must be numbers"],
    [{ price_min: "10", price_max: "5" }, "“Price to” must be at least “Price from”."],
  ])("rejects %o", (over, message) => {
    const result = importedDetailsSchema.safeParse({ ...base, ...over });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
