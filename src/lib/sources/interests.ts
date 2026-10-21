// Tags imported events with the interests people pick in onboarding, so the Interest filter and
// the For-you ranking can match them. Luma does the same: events get topics from their own content,
// not from the host. Pure — no database, no network.

import { ALL_INTERESTS } from "@/lib/taxonomy";
import { contains, normalize, type ClassifiableEvent } from "./classify";

/** Words and phrases (already normalised: lower case, punctuation as spaces) that signal each interest. */
export const INTEREST_KEYWORDS: Record<string, readonly string[]> = {
  consulting: ["consulting", "consultant", "consultants", "consultancy", "case interview", "case competition"],
  finance: [
    "finance", "fintech", "banking", "investment", "investing", "investor", "investors", "trading", "traders",
    "stock market", "stocks", "forex", "crypto", "bitcoin", "tradfi", "defi", "accounting", "venture capital", "wealth",
    "financial",
  ],
  technology: [
    "tech", "technology", "software", "developer", "developers", "coding", "programming", "engineering", "engineers",
    "ai", "artificial intelligence", "machine learning", "llm", "llms", "genai", "chatgpt", "claude", "agentic",
    "ai agents", "multi agent", "web3", "blockchain", "cloud", "devops",
    "cybersecurity", "hackathon", "javascript", "python",
  ],
  marketing: ["marketing", "marketers", "branding", "seo", "advertising", "social media marketing", "content marketing"],
  entrepreneurship: [
    "startup", "startups", "founder", "founders", "entrepreneur", "entrepreneurs", "entrepreneurship",
    "pitch night", "small business", "business owners", "online business", "smes", "bootstrapping",
  ],
  product: ["product management", "product manager", "product managers", "product growth", "product design", "product leaders", "product owner", "product owners"],
  data: ["data", "analytics", "data science", "data scientist", "data engineering", "sql", "power bi", "tableau", "statistics"],
  sustainability: [
    "sustainability", "sustainable", "climate", "esg", "net zero", "environment", "environmental", "renewable",
    "renewables", "recycling", "zero waste",
  ],
  healthcare: ["healthcare", "health tech", "healthtech", "medical", "medicine", "pharma", "biotech", "life sciences", "nhs", "clinical"],
  "public-sector": ["policy", "public policy", "government", "civil service", "public sector", "politics"],
  law: ["law", "legal", "lawyer", "lawyers", "solicitor", "solicitors", "barrister", "attorney"],
  creative: [
    "design", "designer", "designers", "ux", "photography", "photographers", "film", "filmmaking", "writing",
    "writers", "creative", "creatives", "creators", "content creators", "movie", "movies", "filmmakers",
    "illustration", "animation", "fashion",
  ],
  socialising: [
    "social", "socials", "socialising", "socializing", "friends", "new friends", "make friends", "mixer",
    "meet new people", "hangout", "party", "bowling", "pub", "speed friending",
  ],
  fitness: [
    "fitness", "sport", "sports", "running", "run club", "gym", "workout", "yoga", "football", "cricket", "badminton",
    "tennis", "pickleball", "cycling", "climbing", "bouldering", "swimming", "basketball", "volleyball", "marathon",
  ],
  travel: [
    "travel", "travellers", "travelers", "travelling", "traveling", "trip", "trips", "trek", "trekking", "hiking",
    "hike", "outdoors", "outdoor", "adventure", "backpacking", "road trip", "camping",
  ],
  arts: [
    "art", "arts", "culture", "cultural", "museum", "gallery", "theatre", "theater", "book club", "books", "reading",
    "poetry", "literature", "painting", "drawing", "crafts", "pottery", "history", "language exchange",
  ],
  music: ["music", "concert", "gig", "live music", "dj", "karaoke", "nightlife", "jam session", "band", "singing"],
  food: [
    "food", "foodie", "foodies", "drinks", "dinner", "brunch", "coffee", "wine", "beer", "cooking", "baking",
    "restaurant", "tasting", "food drink",
  ],
  wellbeing: [
    "wellbeing", "well being", "wellness", "mental health", "meditation", "mindfulness", "self care", "breathwork",
    "journaling", "gardening", "plants",
  ],
  volunteering: [
    "volunteer", "volunteers", "volunteering", "charity", "fundraiser", "community service",
    "cleanup", "clean up", "nonprofit", "non profit",
  ],
  gaming: ["gaming", "gamers", "video games", "board games", "board game", "esports", "game night", "games night", "chess"],
};

/** Where a keyword appears decides how much it says: the title most, a passing mention least. */
const WEIGHT = { title: 3, tags: 3, summary: 2, description: 1 } as const;

/**
 * Score an interest needs: a hit in the title or tags, a summary hit backed by one more, or three
 * different keywords in the description. Organisers paste boilerplate ("we work across healthcare,
 * clinical…") into every listing, so a couple of passing mentions aren't enough.
 */
export const MIN_SCORE = 3;
/** More than this and the tags stop meaning anything. */
export const MAX_INTERESTS = 4;

const VALUES = new Set<string>(ALL_INTERESTS.map((i) => i.value));

/** The interests an event is clearly about, best first. */
export function inferInterests(event: ClassifiableEvent): string[] {
  const fields = {
    title: normalize(event.title),
    tags: normalize((event.tags ?? []).join(" ")),
    summary: normalize(event.summary ?? ""),
    description: normalize(event.description ?? ""),
  };
  return Object.entries(INTEREST_KEYWORDS)
    .map(([value, terms]) => {
      let score = 0;
      for (const term of terms) {
        score +=
          contains(fields.title, term) ? WEIGHT.title
          : contains(fields.tags, term) ? WEIGHT.tags
          : contains(fields.summary, term) ? WEIGHT.summary
          : contains(fields.description, term) ? WEIGHT.description
          : 0;
      }
      return { value, score };
    })
    .filter((r) => VALUES.has(r.value) && r.score >= MIN_SCORE)
    // Ties keep the taxonomy order, so the result never depends on anything but the event.
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INTERESTS)
    .map((r) => r.value);
}

/** The event's tags plus any inferred interests it's missing (existing tags stay first and are never removed). */
export function withInterests(event: ClassifiableEvent): string[] {
  const tags = event.tags ?? [];
  return [...tags, ...inferInterests(event).filter((i) => !tags.includes(i))];
}
