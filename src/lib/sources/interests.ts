// Tags imported events with the interests people pick in onboarding, so the Interest filter and
// the For-you ranking can match them. Luma does the same: events get topics from their own content,
// not from the host. Pure — no database, no network.

import { ALL_INTERESTS } from "@/lib/taxonomy";
import { contains, normalize, type ClassifiableEvent } from "./classify";
import type { InterestHint } from "./types";

export type { InterestHint };

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
    "business networking", "business referral", "referral meetup", "b2b", "export import", "business strategy",
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
    "design", "designer", "designers", "ux", "photography", "photographers", "film", "filmmaking",
    "creative", "creatives", "creators", "content creators", "movie", "movies", "filmmakers",
    "illustration", "animation", "fashion",
  ],
  ai: [
    "ai", "artificial intelligence", "machine learning", "deep learning", "llm", "llms", "genai", "generative ai",
    "chatgpt", "claude", "openai", "agentic", "ai agents", "multi agent", "prompt engineering", "neural networks",
  ],
  crypto: ["crypto", "cryptocurrency", "bitcoin", "ethereum", "web3", "blockchain", "defi", "nft", "nfts", "solana", "dao"],
  careers: [
    "career", "careers", "career growth", "job", "jobs", "job search", "hiring", "hired", "recruitment", "recruiting",
    "resume", "cv", "interview", "interviews", "internship", "internships", "placement", "placements", "job fair",
    "career fair", "mentorship", "mentoring", "upskilling", "get job", "job seekers",
  ],
  science: [
    "science", "scientific", "scientists", "researchers", "physics", "chemistry", "biology", "astronomy",
    "space", "mathematics", "maths", "math", "stem", "neuroscience", "quantum",
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
    "art", "arts", "culture", "cultural", "museum", "gallery", "theatre", "theater", "painting", "drawing", "history",
    "language exchange",
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
  books: [
    "book", "books", "book club", "reading", "readers", "literature", "poetry", "poems", "writing", "writers",
    "authors", "storytelling", "novel", "novels",
  ],
  growth: [
    "personal growth", "personal development", "self improvement", "self development", "leadership", "coaching",
    "life coaching", "mindset", "productivity", "public speaking", "toastmasters", "confidence", "motivation",
    "habits", "goal setting",
  ],
  hobbies: [
    "hobby", "hobbies", "crafts", "craft", "crafting", "diy", "knitting", "crochet", "sewing", "pottery",
    "woodworking", "origami", "calligraphy", "lego", "model making",
  ],
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

/**
 * What the platform itself says an event is about, and how much to trust it:
 * Luma files each event under categories from its content (strong, 3); a Meetup group has one
 * category (medium, 2) and a list of topics that cover the whole group, not each event (weak, 1).
 * Hints only add evidence: the event's own words still decide most tags.
 */
export const HINT_WEIGHT = { eventCategory: 3, groupCategory: 2, groupTopic: 1 } as const;

/** Platform category names (Meetup's topic categories, Luma's discover categories) → interests. */
const PLATFORM_CATEGORIES: Record<string, string[]> = {
  // Meetup
  "art culture": ["arts"],
  "career business": ["entrepreneurship", "careers"],
  "community environment": ["sustainability", "volunteering"],
  dancing: ["music", "fitness"],
  games: ["gaming"],
  "health wellbeing": ["wellbeing"],
  "hobbies passions": ["hobbies"],
  "identity language": ["arts"],
  "movements politics": ["public-sector"],
  music: ["music"],
  "parents family": ["socialising"],
  "religion spirituality": ["wellbeing"],
  "science education": ["science"],
  "social activities": ["socialising"],
  "sports fitness": ["fitness"],
  "support coaching": ["growth"],
  technology: ["technology"],
  "travel outdoor": ["travel"],
  writing: ["books"],
  // Luma
  ai: ["ai", "technology"],
  "arts culture": ["arts"],
  books: ["books"],
  climate: ["sustainability"],
  crypto: ["crypto"],
  family: ["socialising"],
  fitness: ["fitness"],
  "food drink": ["food"],
  running: ["fitness"],
  tech: ["technology"],
  wellness: ["wellbeing"],
};

/** Interests one hint points to: a known platform category, else its words against the keywords. */
function hintInterests(label: string): string[] {
  const name = normalize(label);
  if (!name) return [];
  if (PLATFORM_CATEGORIES[name]) return PLATFORM_CATEGORIES[name];
  return Object.entries(INTEREST_KEYWORDS)
    .filter(([, terms]) => terms.some((term) => contains(name, term)))
    .map(([value]) => value);
}

/** The interests an event is clearly about, best first. */
export function inferInterests(event: ClassifiableEvent, hints: readonly InterestHint[] = []): string[] {
  const fromHints = new Map<string, number>();
  for (const hint of hints) {
    for (const value of hintInterests(hint.label)) fromHints.set(value, (fromHints.get(value) ?? 0) + hint.weight);
  }
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
      return { value, score: score + (fromHints.get(value) ?? 0) };
    })
    .filter((r) => VALUES.has(r.value) && r.score >= MIN_SCORE)
    // Ties keep the taxonomy order, so the result never depends on anything but the event.
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INTERESTS)
    .map((r) => r.value);
}

/** The event's tags plus any inferred interests it's missing (existing tags stay first and are never removed). */
export function withInterests(event: ClassifiableEvent, hints: readonly InterestHint[] = []): string[] {
  const tags = event.tags ?? [];
  return [...tags, ...inferInterests(event, hints).filter((i) => !tags.includes(i))];
}
