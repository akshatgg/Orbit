// Pure helpers for the Explore dropdown filter bar: which pills exist, what each shows when
// active, and the next URL after picking / clearing a value. Same URL params as filters.ts.

import { ALL_INTERESTS, EVENT_FORMATS, labelFor } from "@/lib/taxonomy";
import {
  DATE_PRESETS, PRICE_OPTIONS, SORT_OPTIONS, activeFilterCount, cleanLocation, searchHref, type SearchFilters,
} from "./filters";

export type FilterKey = "date" | "category" | "interest" | "format" | "price" | "location" | "sort";

export const FILTER_KEYS: readonly FilterKey[] = ["date", "category", "interest", "format", "price", "location", "sort"];

export const FILTER_TITLES: Record<FilterKey, string> = {
  date: "When", category: "Category", interest: "Interest", format: "Format", price: "Price", location: "Location", sort: "Sort",
};

/** Category, interest and format accept several values in the URL; the rest take one. */
export const MULTI_KEYS: readonly FilterKey[] = ["category", "interest", "format"];
export const isMultiKey = (k: FilterKey) => MULTI_KEYS.includes(k);

export type Option = { value: string; label: string; count?: number };

export function optionsFor(key: FilterKey, categories: readonly Option[]): Option[] {
  switch (key) {
    case "date": return DATE_PRESETS;
    case "category": return [...categories];
    case "interest": return [...ALL_INTERESTS];
    case "format": return [...EVENT_FORMATS];
    case "price": return [...PRICE_OPTIONS];
    case "sort": return [...SORT_OPTIONS];
    case "location": return [];
  }
}

/** Selected option values for a pill. */
export function selectedValues(f: SearchFilters, key: FilterKey): string[] {
  switch (key) {
    case "date": return f.date ? [f.date] : [];
    case "category": return f.categories;
    case "interest": return f.interests;
    case "format": return f.formats;
    case "price": return f.price ? [f.price] : [];
    case "location": return f.location ? [f.location] : [];
    case "sort": return [f.sort];
  }
}

/** Sort only counts as active when it differs from the default. */
export function isActive(f: SearchFilters, key: FilterKey): boolean {
  return key === "sort" ? f.sort !== "relevance" : selectedValues(f, key).length > 0;
}

/** Pill text: the plain title, or the chosen value ("Workshop", "Workshop +2", "Near X"). */
export function pillLabel(f: SearchFilters, key: FilterKey, categories: readonly Option[]): string {
  if (!isActive(f, key)) return FILTER_TITLES[key];
  const vals = selectedValues(f, key);
  if (key === "location") return f.location;
  const opts = optionsFor(key, categories);
  const first = labelFor(opts, vals[0]);
  return vals.length > 1 ? `${first} +${vals.length - 1}` : first;
}

/** The search with `value` picked (or toggled off, for multi pills / re-picking a single one). */
export function pickHref(f: SearchFilters, key: FilterKey, value: string): string {
  const toggle = <T extends string>(xs: T[]) => (xs.includes(value as T) ? xs.filter((x) => x !== value) : [...xs, value as T]);
  switch (key) {
    case "date": return searchHref({ ...f, date: f.date === value ? null : (value as SearchFilters["date"]) });
    case "category": return searchHref({ ...f, categories: toggle(f.categories) });
    case "interest": return searchHref({ ...f, interests: toggle(f.interests) });
    case "format": return searchHref({ ...f, formats: toggle(f.formats) });
    case "price": return searchHref({ ...f, price: f.price === value ? null : (value as SearchFilters["price"]) });
    case "sort": return searchHref({ ...f, sort: value as SearchFilters["sort"] });
    case "location": return searchHref({ ...f, location: cleanLocation(value) });
  }
}

/** The search with just this one filter cleared. */
export function clearKeyHref(f: SearchFilters, key: FilterKey): string {
  switch (key) {
    case "date": return searchHref({ ...f, date: null });
    case "category": return searchHref({ ...f, categories: [] });
    case "interest": return searchHref({ ...f, interests: [] });
    case "format": return searchHref({ ...f, formats: [] });
    case "price": return searchHref({ ...f, price: null });
    case "location": return searchHref({ ...f, location: "" });
    case "sort": return searchHref({ ...f, sort: "relevance" });
  }
}

/** Clear-all is offered whenever a real filter (not just sort) is active. */
export const showClearAll = (f: SearchFilters) => activeFilterCount(f) > 0;
