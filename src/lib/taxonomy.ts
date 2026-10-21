// Shared option lists used by onboarding, ranking, filters and the event wizard.

export const CAREER_INTERESTS = [
  { value: "consulting", label: "Consulting" },
  { value: "finance", label: "Finance & banking" },
  { value: "technology", label: "Technology" },
  { value: "marketing", label: "Marketing" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "product", label: "Product management" },
  { value: "data", label: "Data & analytics" },
  { value: "sustainability", label: "Sustainability & ESG" },
  { value: "healthcare", label: "Healthcare & life sciences" },
  { value: "public-sector", label: "Public sector & policy" },
  { value: "law", label: "Law" },
  { value: "creative", label: "Creative industries" },
  { value: "ai", label: "AI" },
  { value: "crypto", label: "Crypto & Web3" },
  { value: "careers", label: "Career growth" },
  { value: "science", label: "Science & research" },
] as const;

export const PERSONAL_INTERESTS = [
  { value: "socialising", label: "Socialising" },
  { value: "fitness", label: "Fitness & sport" },
  { value: "travel", label: "Travel" },
  { value: "sustainability", label: "Sustainability" },
  { value: "arts", label: "Arts & culture" },
  { value: "music", label: "Music & nightlife" },
  { value: "food", label: "Food & drink" },
  { value: "wellbeing", label: "Wellbeing" },
  { value: "volunteering", label: "Volunteering" },
  { value: "gaming", label: "Gaming" },
  { value: "books", label: "Books & writing" },
  { value: "growth", label: "Personal growth" },
  { value: "hobbies", label: "Hobbies & crafts" },
] as const;

/** Every interest once (sustainability is in both lists): what events are tagged with and filtered by. */
export const ALL_INTERESTS = [...CAREER_INTERESTS, ...PERSONAL_INTERESTS].filter(
  (o, i, all) => all.findIndex((x) => x.value === o.value) === i,
);

/** Free-text tags that mean the same thing as an interest value. */
export const TAG_SYNONYMS: Record<string, string> = {
  tech: "technology",
  "artificial intelligence": "ai",
  "machine learning": "ai",
  web3: "crypto",
  blockchain: "crypto",
  career: "careers",
  jobs: "careers",
  reading: "books",
  "book club": "books",
  writing: "books",
  startups: "entrepreneurship",
  startup: "entrepreneurship",
  banking: "finance",
  "investment banking": "finance",
  esg: "sustainability",
  "net zero": "sustainability",
  analytics: "data",
  "data science": "data",
  "product management": "product",
  policy: "public-sector",
  running: "fitness",
  sport: "fitness",
  sports: "fitness",
  social: "socialising",
  art: "arts",
  "arts & culture": "arts",
  culture: "arts",
  "food & drink": "food",
  nightlife: "music",
};

/** The tags that count as an interest: its own value plus every synonym of it. */
export const interestTags = (value: string) => [value, ...Object.keys(TAG_SYNONYMS).filter((t) => TAG_SYNONYMS[t] === value)];

export const EVENT_FORMATS = [
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export const ORGANISER_KINDS = [
  { value: "society", label: "Student society" },
  { value: "university", label: "University team / department" },
  { value: "employer", label: "Employer" },
  { value: "community", label: "Community / meetup" },
  { value: "other", label: "Other" },
] as const;

export const UNIVERSITIES = ["Imperial College London"] as const;

export const WEEKDAYS = [
  { value: "mon", label: "Mon" }, { value: "tue", label: "Tue" }, { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" }, { value: "fri", label: "Fri" }, { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
] as const;

/** Parts of the day used for availability. Hours are UK local time [start, end). */
export const DAY_PARTS = [
  { value: "morning", label: "Morning", hours: [6, 12] },
  { value: "day", label: "Afternoon", hours: [12, 17] },
  { value: "evening", label: "Evening", hours: [17, 24] },
] as const;

export const labelFor = (list: readonly { value: string; label: string }[], value: string) =>
  list.find((o) => o.value === value)?.label ?? value;
