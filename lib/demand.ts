// Scout demand source.
// Primary: Hacker News Algolia API (fully open, no auth, never blocks datacenter IPs).
// Fallback: a curated queue of realistic small jobs so the loop ALWAYS produces work.
//
// Reddit's r/forhire JSON returns 403 for datacenter IPs (Vercel, local), so it is
// not viable as a live source. HN Algolia is the reliable replacement.

export interface DemandItem {
  source: string; // 'hn' | 'curated'
  source_url: string;
  title: string;
  body: string;
  budget_text: string | null;
}

interface AlgoliaHit {
  objectID: string;
  comment_text?: string;
  story_title?: string;
  story_text?: string;
  title?: string;
  author?: string;
  created_at?: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

// Queries that surface freelance/hiring demand in HN comments.
const HN_QUERIES = [
  "seeking freelancer",
  "looking for freelancer",
  "freelancer",
];

/** Strip HTML tags + decode the few entities HN comments contain. */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a budget mention, e.g. "$50" or "$200/hr". */
function extractBudget(text: string): string | null {
  const match = text.match(/\$[\d,]+(?:\/hr|\/hour|\/mo|\/month|k)?/i);
  return match ? match[0] : null;
}

/**
 * Fetch recent HN comments that read like freelance/hiring demand.
 * Returns [] on any failure (fail-open).
 */
export async function fetchHackerNewsDemand(): Promise<DemandItem[]> {
  const items: DemandItem[] = [];

  for (const query of HN_QUERIES) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?tags=comment&query=${encodeURIComponent(
        query
      )}&hitsPerPage=30`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        console.warn(`[demand] HN fetch failed for "${query}": ${res.status}`);
        continue;
      }

      const json: AlgoliaResponse = await res.json();

      for (const hit of json.hits ?? []) {
        const raw = hit.comment_text ?? hit.story_text ?? "";
        if (!raw) continue;

        const body = stripHtml(raw);
        // Skip trivially short comments — not real job descriptions
        if (body.length < 60) continue;

        const title =
          (hit.story_title ?? hit.title ?? body.slice(0, 80)).trim() ||
          "Hacker News freelance request";

        items.push({
          source: "hn",
          source_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: title.slice(0, 160),
          body: body.slice(0, 2000),
          budget_text: extractBudget(body),
        });
      }
    } catch (err) {
      console.warn(`[demand] HN error for "${query}":`, err);
    }
  }

  // Dedupe by source_url
  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i.source_url)) return false;
    seen.add(i.source_url);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Curated fallback queue: realistic small jobs an AI can actually deliver.
// Guarantees the demo loop never stalls when HN is empty or exhausted.
// Each call to nextCuratedItem() returns a fresh, unique-URL item.
// ---------------------------------------------------------------------------

const CURATED_TEMPLATES: Omit<DemandItem, "source_url">[] = [
  {
    source: "curated",
    title: "Write a SaaS landing page hero section",
    body: "I just built an invoicing tool for freelance designers and my homepage copy is flat. I need a punchy hero headline plus a 70-90 word supporting paragraph that explains the product and pushes a free trial. Tone: confident, no jargon.",
    budget_text: "$25",
  },
  {
    source: "curated",
    title: "Summarise a 10-page strategy document into one page",
    body: "I have a long internal strategy memo (roughly 10 pages) and need a clean one-page executive summary with the three key decisions and the rationale behind each. Bullet points are fine. The text is pasted below.",
    budget_text: "$40",
  },
  {
    source: "curated",
    title: "Draft 5 cold outreach emails for a B2B SaaS",
    body: "We sell an analytics dashboard to e-commerce founders. I need 5 short cold emails (under 120 words each), each with a different angle: time saved, revenue lift, competitor benchmark, free audit offer, and a short follow-up. Friendly, not salesy.",
    budget_text: "$50",
  },
  {
    source: "curated",
    title: "Clean up and standardise a messy CSV of contacts",
    body: "I have a list of about 200 contacts with inconsistent capitalisation, mixed name formats, and stray whitespace. I need rules and a cleaned output: proper case names, split first/last, normalised company names, and flagged duplicates. Describe the transformation clearly.",
    budget_text: "$30",
  },
  {
    source: "curated",
    title: "Write product descriptions for 8 handmade candles",
    body: "Etsy shop. I need short, evocative product descriptions (40-60 words each) for 8 soy candles with scents like sea salt, fig, smoked cedar, and bergamot. Each should hint at a mood or moment. List of names and scents below.",
    budget_text: "$35",
  },
  {
    source: "curated",
    title: "Research and summarise 3 competitors for a note-taking app",
    body: "I'm validating a minimalist note-taking app. I need a short competitive brief on three well-known alternatives: their core positioning, pricing model, one standout strength, and one common complaint each. Keep it tight and factual.",
    budget_text: "$45",
  },
  {
    source: "curated",
    title: "Draft a job spec for a part-time community manager",
    body: "Early-stage startup. We want to hire a part-time community manager for our Discord and Twitter. I need a clear job spec: responsibilities, must-have skills, nice-to-haves, hours, and a short company blurb. Make it appealing but honest.",
    budget_text: "$40",
  },
  {
    source: "curated",
    title: "Rewrite a confusing FAQ section to be clear and friendly",
    body: "Our support FAQ has 6 entries written in stiff legalese and customers keep emailing the same questions. I need them rewritten in plain, warm English while keeping the meaning accurate. Original entries pasted below.",
    budget_text: "$30",
  },
];

let curatedIndex = 0;

/**
 * Return the next curated job with a unique source_url so dedupe never blocks it.
 * Cycles through the template list, appending a counter to guarantee uniqueness.
 */
export function nextCuratedItem(): DemandItem {
  const template = CURATED_TEMPLATES[curatedIndex % CURATED_TEMPLATES.length];
  const cycle = Math.floor(curatedIndex / CURATED_TEMPLATES.length);
  curatedIndex++;

  const suffix =
    cycle > 0
      ? `-r${cycle}`
      : "";
  const slug = template.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    ...template,
    source_url: `curated://job/${slug}${suffix}`,
  };
}

/**
 * Unified demand fetch for the Scout.
 * Tries HN first; always appends one curated item so a tick never produces
 * zero candidates. Scout then dedupes by source_url against existing jobs.
 */
export async function fetchDemand(): Promise<DemandItem[]> {
  const hn = await fetchHackerNewsDemand();
  // Always include one fresh curated item as the reliability guarantee.
  const curated = nextCuratedItem();
  return [...hn, curated];
}
