import { z } from "zod";

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const categorySchema = z.object({
  name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(2, "At least 2 characters").max(60, "Keep it under 60 characters")),
  slug: z.preprocess(
    (v) => slugify(String(v ?? "")),
    z.string().min(2, "Slug is required").max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens"),
  ),
  group: z.enum(["career", "social", "other"], { error: "Pick a group" }),
  sort_order: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z.number({ error: "Enter a whole number" }).int("Enter a whole number").min(-1000).max(100000),
  ),
  // Comma separated in the form; stored as text[] for the keyword classifier.
  keywords: z.preprocess(
    (v) => [...new Set(String(v ?? "").toLowerCase().split(",").map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 30),
    z.array(z.string().min(2, "Keep each keyword at least 2 characters").max(40, "Keep each keyword under 40 characters")),
  ),
});

export type CategoryInput = z.output<typeof categorySchema>;
