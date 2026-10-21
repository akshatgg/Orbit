// Explore filters live in the URL (GET form → shareable links). This file parses and
// rebuilds them. Pure — safe for tests and for both server and client code.

import { z } from "zod";
import { ALL_INTERESTS, EVENT_FORMATS, labelFor } from "@/lib/taxonomy";
import type { DatePreset } from "./dates";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "weekend", label: "This weekend" },
  { value: "month", label: "Next 30 days" },
];

export const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "date", label: "Date" },
  { value: "deadline", label: "Deadline" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];
export type FormatKey = (typeof EVENT_FORMATS)[number]["value"];

export type SearchFilters = {
  q: string;
  date: DatePreset | null;
  categories: string[];
  interests: string[];
  formats: FormatKey[];
  location: string;
  sort: SortKey;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const MAX_LIST = 12;

const list = (v: unknown) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).filter((x): x is string => typeof x === "string");
const first = (v: unknown) => list(v)[0];

const interestValues: string[] = ALL_INTERESTS.map((i) => i.value);
const formatValues = EVENT_FORMATS.map((f) => f.value) as [FormatKey, ...FormatKey[]];

/** Letters, numbers, spaces and a little punctuation — safe inside a PostgREST filter. */
export function cleanLocation(raw: string) {
  return raw.replace(/[^\p{L}\p{N} '&-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

const schema = z.object({
  q: z.string().trim().max(120).catch(""),
  date: z.enum(["today", "week", "weekend", "month"]).nullable().catch(null),
  location: z.string().transform(cleanLocation).catch(""),
  sort: z.enum(["relevance", "date", "deadline"]).catch("relevance"),
});

const uniq = <T,>(xs: T[]) => [...new Set(xs)].slice(0, MAX_LIST);
const validOnly = <T extends string>(xs: string[], ok: (x: string) => x is T) => uniq(xs.filter(ok));

/**
 * Turns raw search params into clean, validated filters. Invalid values are dropped, never thrown:
 * scalars go through zod (`.catch` → default), list params are filtered value by value.
 */
export function parseSearchFilters(raw: RawSearchParams): SearchFilters {
  const parsed = schema.parse({
    q: first(raw.q) ?? "",
    date: first(raw.date) ?? null,
    location: first(raw.location) ?? "",
    sort: first(raw.sort) ?? "relevance",
  });
  const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return {
    ...parsed,
    categories: validOnly(list(raw.category), (x): x is string => slug.test(x) && x.length <= 60),
    interests: validOnly(list(raw.interest), (x): x is string => interestValues.includes(x)),
    formats: validOnly(list(raw.format), (x): x is FormatKey => (formatValues as string[]).includes(x)),
  };
}

/** Rebuilds the query string (defaults left out so URLs stay short). */
export function toSearchParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.date) p.set("date", f.date);
  for (const c of f.categories) p.append("category", c);
  for (const i of f.interests) p.append("interest", i);
  for (const fm of f.formats) p.append("format", fm);
  if (f.location) p.set("location", f.location);
  if (f.sort !== "relevance") p.set("sort", f.sort);
  return p;
}

export function searchHref(f: SearchFilters): string {
  const qs = toSearchParams(f).toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Number of active filters (the search text and sort don't count). */
export function activeFilterCount(f: SearchFilters): number {
  return (
    (f.date ? 1 : 0) + f.categories.length + f.interests.length + f.formats.length +
    (f.location ? 1 : 0)
  );
}

/** True when the page should show results rather than the browse view. */
export function isSearching(f: SearchFilters): boolean {
  return f.q.length > 0 || activeFilterCount(f) > 0;
}

export type FilterChip = { key: string; label: string; href: string };

/** One removable chip per active filter, each linking to the same search without it. */
export function activeFilterChips(f: SearchFilters, categoryNames: ReadonlyMap<string, string>): FilterChip[] {
  const chips: FilterChip[] = [];
  const without = (patch: Partial<SearchFilters>) => searchHref({ ...f, ...patch });
  if (f.date) {
    chips.push({ key: `date`, label: DATE_PRESETS.find((d) => d.value === f.date)?.label ?? f.date, href: without({ date: null }) });
  }
  for (const c of f.categories) {
    chips.push({ key: `category:${c}`, label: categoryNames.get(c) ?? c, href: without({ categories: f.categories.filter((x) => x !== c) }) });
  }
  for (const i of f.interests) {
    chips.push({ key: `interest:${i}`, label: labelFor(ALL_INTERESTS, i), href: without({ interests: f.interests.filter((x) => x !== i) }) });
  }
  for (const fm of f.formats) {
    chips.push({ key: `format:${fm}`, label: labelFor(EVENT_FORMATS, fm), href: without({ formats: f.formats.filter((x) => x !== fm) }) });
  }
  if (f.location) chips.push({ key: "location", label: `Near “${f.location}”`, href: without({ location: "" }) });
  return chips;
}

/** Same search with every filter cleared (keeps the search text). */
export function clearFiltersHref(f: SearchFilters): string {
  return searchHref({ ...f, date: null, categories: [], interests: [], formats: [], location: "" });
}
