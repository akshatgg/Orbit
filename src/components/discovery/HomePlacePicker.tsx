"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { placeValue, parsePlaceValue } from "@/lib/discovery/filter-bar";
import type { PlaceGroup } from "@/lib/places";

/** "Browsing events in [Bengaluru ▾]": switches the home page's lists to another place. */
export function HomePlacePicker({ places, value, view }: { places: PlaceGroup[]; value: string; view: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function pick(next: string) {
    const params = new URLSearchParams();
    if (view !== "foryou") params.set("view", view);
    const { country, city } = parsePlaceValue(next);
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/?${qs}#browse` : "/#browse", { scroll: false }));
  }
  return (
    <label className={`relative inline-flex items-center self-start md:self-auto ${pending ? "opacity-60" : ""}`}>
      <span className="sr-only">Place</span>
      <select
        value={value}
        onChange={(e) => pick(e.target.value)}
        className="field-sizing-content cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-1 pr-7 text-xl font-semibold md:text-2xl tracking-tight text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <option value="">everywhere</option>
        {places.map((group) => (
          <optgroup key={group.country ?? "other"} label={`${group.flag} ${group.name}`.trim()}>
            {group.country && <option value={placeValue(group.country, "")}>{group.name}</option>}
            {group.cities.map((c) => (
              <option key={c.city} value={placeValue(group.country, c.city)}>{c.city}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute right-1 h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </label>
  );
}
