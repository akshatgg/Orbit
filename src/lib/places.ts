// Places for the Location filter: country codes and names, well-known cities (with the other
// spellings platforms use), and grouping upcoming events into country → city lists.
//
// Imported events store the country their platform gives (`events.country`, ISO 3166 alpha-2).
// Events that only have a city (organiser events, plain calendar feeds) get their country from
// KNOWN_CITIES when they're grouped and filtered, so nothing has to be backfilled.

type KnownCity = { city: string; country: string; aliases?: string[] };

/** Cities ORBIT recognises without a country, with the other names they appear under. */
export const KNOWN_CITIES: readonly KnownCity[] = [
  // United Kingdom
  ...[
    "London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Glasgow", "Edinburgh", "Bristol", "Sheffield",
    "Nottingham", "Leicester", "Cardiff", "Belfast", "Oxford", "Cambridge", "Brighton", "Southampton", "Reading",
    "Coventry", "York", "Bath", "Aberdeen", "Dundee", "Exeter", "Norwich", "Milton Keynes", "Canterbury", "Durham",
    "Lancaster", "Guildford", "Warwick", "St Andrews", "Swansea", "Plymouth", "Portsmouth", "Bournemouth",
  ].map((city) => ({ city, country: "GB" })),
  { city: "Newcastle", country: "GB", aliases: ["Newcastle upon Tyne", "Newcastle-upon-Tyne"] },
  // India
  { city: "Delhi", country: "IN", aliases: ["New Delhi", "NCT of Delhi"] },
  { city: "Mumbai", country: "IN", aliases: ["Bombay", "Navi Mumbai"] },
  { city: "Bengaluru", country: "IN", aliases: ["Bangalore"] },
  { city: "Chennai", country: "IN", aliases: ["Madras"] },
  { city: "Kolkata", country: "IN", aliases: ["Calcutta"] },
  { city: "Gurugram", country: "IN", aliases: ["Gurgaon"] },
  { city: "Noida", country: "IN", aliases: ["Greater Noida"] },
  { city: "Kochi", country: "IN", aliases: ["Cochin"] },
  { city: "Mysuru", country: "IN", aliases: ["Mysore"] },
  { city: "Thiruvananthapuram", country: "IN", aliases: ["Trivandrum"] },
  { city: "Visakhapatnam", country: "IN", aliases: ["Vizag"] },
  ...[
    "Hyderabad", "Pune", "Ahmedabad", "Jaipur", "Chandigarh", "Mohali", "Lucknow", "Indore", "Bhopal", "Nagpur",
    "Surat", "Coimbatore", "Ghaziabad", "Faridabad", "Kanpur", "Varanasi", "Patna", "Bhubaneswar", "Dehradun",
    "Amritsar", "Ludhiana", "Vadodara", "Goa",
  ].map((city) => ({ city, country: "IN" })),
  // A few big cities elsewhere
  { city: "New York", country: "US", aliases: ["New York City", "NYC"] },
  { city: "San Francisco", country: "US" },
  { city: "Los Angeles", country: "US" },
  { city: "Paris", country: "FR" },
  { city: "Berlin", country: "DE" },
  { city: "Amsterdam", country: "NL" },
  { city: "Dublin", country: "IE" },
  { city: "Dubai", country: "AE" },
  { city: "Singapore", country: "SG" },
  { city: "Toronto", country: "CA" },
  { city: "Sydney", country: "AU" },
];

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const BY_NAME = new Map<string, KnownCity>();
for (const known of KNOWN_CITIES) {
  for (const name of [known.city, ...(known.aliases ?? [])]) BY_NAME.set(key(name), known);
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "IN" -> "India", "GB" -> "United Kingdom". */
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "IN" -> 🇮🇳 */
export function countryFlag(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";
}

/** A code the browser can name as a real country ("ZZ" is "Unknown Region"). */
const isCountry = (code: string) => {
  const name = countryName(code);
  return name !== code && name !== "Unknown Region";
};

// Country names (and the usual short forms) back to their codes.
const CODE_BY_NAME = new Map<string, string>([
  ["uk", "GB"], ["great britain", "GB"], ["britain", "GB"], ["england", "GB"], ["scotland", "GB"], ["wales", "GB"],
  ["northern ireland", "GB"], ["usa", "US"], ["us", "US"], ["united states of america", "US"], ["uae", "AE"],
]);
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    if (isCountry(code) && !CODE_BY_NAME.has(key(countryName(code)))) CODE_BY_NAME.set(key(countryName(code)), code);
  }
}

/** A platform's country ("gb", "IN", "United Kingdom") as an ISO code, or null when it isn't one. */
export function normaliseCountry(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (/^[A-Za-z]{2}$/.test(value)) {
    const code = value.toUpperCase();
    if (code === "UK") return "GB";
    return isCountry(code) ? code : null;
  }
  return CODE_BY_NAME.get(key(value)) ?? null;
}

/** The usual name for a city ("Bangalore" -> "Bengaluru"); unknown cities are just tidied. */
export function canonicalCity(city: string): string {
  return BY_NAME.get(key(city))?.city ?? city.trim().replace(/\s+/g, " ");
}

/** Every spelling of a city that should match when someone picks it. */
export function cityVariants(city: string): string[] {
  const known = BY_NAME.get(key(city));
  return known ? [known.city, ...(known.aliases ?? [])] : [canonicalCity(city)];
}

/** Known cities of a country, every spelling (events without a stored country still match it). */
export function knownCityNames(country: string): string[] {
  return KNOWN_CITIES.filter((c) => c.country === country).flatMap((c) => [c.city, ...(c.aliases ?? [])]);
}

/** Where an event is: its stored country, else the country of a known city. */
export function placeOf(city: string | null | undefined, country: string | null | undefined): { country: string | null; city: string | null } {
  const name = city?.trim() ? canonicalCity(city) : null;
  return { country: normaliseCountry(country) ?? (name ? BY_NAME.get(key(name))?.country ?? null : null), city: name };
}

export type PlaceCity = { city: string; count: number };
export type PlaceGroup = { country: string | null; name: string; flag: string; count: number; cities: PlaceCity[] };

/**
 * Upcoming events as country → city lists with counts, biggest first. A recurring series counts
 * once. Places without a known country are grouped last under "Other places".
 */
export function groupPlaces(rows: { id: string; city: string | null; country: string | null; series_key?: string | null }[]): PlaceGroup[] {
  const countries = new Map<string, { all: Set<string>; cities: Map<string, Set<string>> }>();
  for (const row of rows) {
    const place = placeOf(row.city, row.country);
    if (!place.country && !place.city) continue;
    const id = row.series_key ?? row.id;
    const group = countries.get(place.country ?? "") ?? { all: new Set<string>(), cities: new Map<string, Set<string>>() };
    group.all.add(id);
    if (place.city) group.cities.set(place.city, (group.cities.get(place.city) ?? new Set<string>()).add(id));
    countries.set(place.country ?? "", group);
  }
  const groups: PlaceGroup[] = [...countries].map(([code, group]) => ({
    country: code || null,
    name: code ? countryName(code) : "Other places",
    flag: code ? countryFlag(code) : "",
    count: group.all.size,
    cities: [...group.cities]
      .map(([city, ids]) => ({ city, count: ids.size }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)),
  }));
  return groups
    .filter((g) => g.country || g.cities.length > 0)
    .sort((a, b) => Number(!a.country) - Number(!b.country) || b.count - a.count || a.name.localeCompare(b.name));
}
