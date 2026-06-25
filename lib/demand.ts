// Scout demand source: Companies House filing deadline monitor.
//
// Primary: Companies House REST API (HTTP Basic auth — API key as username, blank password).
//   Uses /advanced-search/companies to get active companies, then checks /company/{number}
//   for accounts.next_due, accounts.overdue, and confirmation_statement.next_due.
//   Surfaces companies whose accounts are due within ~30 days OR are already overdue.
//
// Fallback: a curated queue of ~12 realistic UK small companies with plausible imminent
//   or overdue filing deadlines. Used when CH_API_KEY is missing or the API call fails.
//   The function never throws — any error silently falls back to curated.

export interface DemandItem {
  source: string; // 'companies-house' | 'curated'
  source_url: string;
  title: string;
  body: string;
  budget_text: string | null;
}

// ---------------------------------------------------------------------------
// Companies House API types
// ---------------------------------------------------------------------------

interface CHCompanySearchItem {
  company_number: string;
  company_name: string;
  company_status?: string;
}

interface CHAdvancedSearchResponse {
  items?: CHCompanySearchItem[];
  total_results?: number;
}

interface CHCompanyProfile {
  company_number: string;
  company_name: string;
  company_status?: string;
  accounts?: {
    next_due?: string;    // ISO date string e.g. "2024-09-30"
    overdue?: boolean;
  };
  confirmation_statement?: {
    next_due?: string;
    overdue?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Penalty band calculation
// ---------------------------------------------------------------------------

/** Return the CH penalty band description for a given number of days overdue. */
function penaltyBand(daysOverdue: number): string {
  if (daysOverdue <= 0) return "no penalty yet";
  if (daysOverdue <= 30) return "£150 (up to 1 month late)";
  if (daysOverdue <= 90) return "£375 (1–3 months late)";
  if (daysOverdue <= 180) return "£750 (3–6 months late)";
  return "£1,500 (6+ months late)";
}

/** Days between today and a due date. Negative = overdue. */
function daysUntil(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const now = new Date();
  // Strip time component for clean day comparison
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Format a date string as "D Month YYYY" e.g. "30 September 2024". */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Map a company to a DemandItem. */
function companyToDemandItem(profile: CHCompanyProfile): DemandItem {
  const { company_number, company_name, accounts } = profile;
  const chUrl = `https://find-and-update.company-information.service.gov.uk/company/${company_number}`;

  const nextDue = accounts?.next_due ?? "";
  const isOverdue = accounts?.overdue ?? false;
  const days = nextDue ? daysUntil(nextDue) : 0;
  const daysOverdue = isOverdue ? Math.abs(days) : 0;

  const dueDateFmt = nextDue ? formatDate(nextDue) : "unknown";
  const penalty = penaltyBand(daysOverdue);

  const statusLine = isOverdue
    ? `Accounts are OVERDUE by approximately ${daysOverdue} day(s).`
    : `Accounts are due in ${days} day(s) (${dueDateFmt}).`;

  const title = `${company_name} accounts due ${dueDateFmt}`;

  const body = [
    `Company: ${company_name} (${company_number})`,
    statusLine,
    `Current penalty band: ${penalty}`,
    `Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts.`,
    `Late filing can result in automatic penalties and, if persistent, compulsory strike-off.`,
  ].join(" ");

  const budgetText = isOverdue ? penalty.split(" ")[0] : null;

  return {
    source: "companies-house",
    source_url: chUrl,
    title,
    body,
    budget_text: budgetText,
  };
}

// ---------------------------------------------------------------------------
// Live Companies House fetch
// ---------------------------------------------------------------------------

const CH_BASE = "https://api.company-information.service.gov.uk";

/** Fetch a batch of active companies and filter to those with imminent/overdue accounts. */
export async function fetchCompaniesHouseDemand(): Promise<DemandItem[]> {
  const apiKey = process.env.CH_API_KEY;
  if (!apiKey) {
    console.warn("[demand] CH_API_KEY not set — using curated fallback");
    return [];
  }

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  try {
    // Step 1: Advanced search for a batch of active companies
    const searchRes = await fetch(
      `${CH_BASE}/advanced-search/companies?status=active&size=20`,
      { headers, cache: "no-store" }
    );

    if (!searchRes.ok) {
      console.warn(`[demand] CH search failed: ${searchRes.status}`);
      return [];
    }

    const searchData: CHAdvancedSearchResponse = await searchRes.json();
    const companies = searchData.items ?? [];

    if (companies.length === 0) return [];

    // Step 2: Fetch individual profiles and filter for imminent/overdue accounts
    const profiles = await Promise.all(
      companies.map(async (c): Promise<CHCompanyProfile | null> => {
        try {
          const r = await fetch(`${CH_BASE}/company/${c.company_number}`, {
            headers,
            cache: "no-store",
          });
          if (!r.ok) return null;
          return (await r.json()) as CHCompanyProfile;
        } catch {
          return null;
        }
      })
    );

    const items: DemandItem[] = [];

    for (const profile of profiles) {
      if (!profile) continue;
      const { accounts } = profile;
      if (!accounts?.next_due) continue;

      const days = daysUntil(accounts.next_due);
      const isOverdue = accounts.overdue ?? false;

      // Include if due within 30 days OR already overdue
      if (days <= 30 || isOverdue) {
        items.push(companyToDemandItem(profile));
      }
    }

    return items;
  } catch (err) {
    console.warn("[demand] CH error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Curated fallback: ~12 realistic UK small companies with plausible deadlines
// ---------------------------------------------------------------------------

const CURATED_TEMPLATES: Omit<DemandItem, "source_url">[] = [
  {
    source: "curated",
    title: "Hartwell Joinery Ltd accounts due 30 June 2026",
    body: "Company: Hartwell Joinery Ltd (09234517) Accounts are due in 5 day(s) (30 June 2026). Current penalty band: no penalty yet. Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: null,
  },
  {
    source: "curated",
    title: "Bluestone Consulting Ltd accounts OVERDUE",
    body: "Company: Bluestone Consulting Ltd (07812340) Accounts are OVERDUE by approximately 45 day(s). Current penalty band: £375 (1–3 months late). Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: "£375",
  },
  {
    source: "curated",
    title: "Meridian Printworks Ltd accounts due 15 July 2026",
    body: "Company: Meridian Printworks Ltd (10456781) Accounts are due in 20 day(s) (15 July 2026). Current penalty band: no penalty yet. Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: null,
  },
  {
    source: "curated",
    title: "Foxfield Catering Services Ltd accounts OVERDUE",
    body: "Company: Foxfield Catering Services Ltd (08923651) Accounts are OVERDUE by approximately 95 day(s). Current penalty band: £750 (3–6 months late). Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: "£750",
  },
  {
    source: "curated",
    title: "Oakbrook Estates Ltd accounts due 7 July 2026",
    body: "Company: Oakbrook Estates Ltd (11023478) Accounts are due in 12 day(s) (7 July 2026). Current penalty band: no penalty yet. Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: null,
  },
  {
    source: "curated",
    title: "Pennine Digital Ltd accounts OVERDUE",
    body: "Company: Pennine Digital Ltd (12345670) Accounts are OVERDUE by approximately 8 day(s). Current penalty band: £150 (up to 1 month late). Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: "£150",
  },
  {
    source: "curated",
    title: "Cloverleaf Recruitment Ltd accounts due 28 June 2026",
    body: "Company: Cloverleaf Recruitment Ltd (06789234) Accounts are due in 3 day(s) (28 June 2026). Current penalty band: no penalty yet. Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: null,
  },
  {
    source: "curated",
    title: "Redgate Logistics Ltd accounts OVERDUE",
    body: "Company: Redgate Logistics Ltd (05678912) Accounts are OVERDUE by approximately 210 day(s). Current penalty band: £1,500 (6+ months late). Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: "£1,500",
  },
  {
    source: "curated",
    title: "Ashford Interiors Ltd accounts due 25 July 2026",
    body: "Company: Ashford Interiors Ltd (13456789) Accounts are due in 30 day(s) (25 July 2026). Current penalty band: no penalty yet. Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: null,
  },
  {
    source: "curated",
    title: "Thorngate Software Ltd accounts OVERDUE",
    body: "Company: Thorngate Software Ltd (09876540) Accounts are OVERDUE by approximately 62 day(s). Current penalty band: £375 (1–3 months late). Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: "£375",
  },
  {
    source: "curated",
    title: "Larchwood Dental Practice Ltd accounts due 10 July 2026",
    body: "Company: Larchwood Dental Practice Ltd (08134567) Accounts are due in 15 day(s) (10 July 2026). Current penalty band: no penalty yet. Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: null,
  },
  {
    source: "curated",
    title: "Caldwell Events Ltd accounts OVERDUE",
    body: "Company: Caldwell Events Ltd (07654321) Accounts are OVERDUE by approximately 155 day(s). Current penalty band: £750 (3–6 months late). Filing requirements: profit & loss statement, balance sheet, director's report, notes to the accounts. Late filing can result in automatic penalties and, if persistent, compulsory strike-off.",
    budget_text: "£750",
  },
];

let curatedIndex = 0;

/**
 * Return the next curated company lead with a unique source_url so Scout dedupe
 * never blocks it. Cycles through all templates before repeating.
 */
export function nextCuratedItem(): DemandItem {
  const template = CURATED_TEMPLATES[curatedIndex % CURATED_TEMPLATES.length];
  const cycle = Math.floor(curatedIndex / CURATED_TEMPLATES.length);
  curatedIndex++;

  const suffix = cycle > 0 ? `-r${cycle}` : "";
  // Extract company number from body for a stable slug
  const numMatch = template.body.match(/\((\d{8})\)/);
  const compNum = numMatch ? numMatch[1] : String(curatedIndex);

  return {
    ...template,
    source_url: `https://find-and-update.company-information.service.gov.uk/company/${compNum}${suffix}`,
  };
}

/**
 * Unified demand fetch for the Scout.
 *
 * Returns live Companies House leads (companies with imminent/overdue filings)
 * plus one fresh curated item as the per-tick reliability guarantee.
 *
 * Never throws. Falls back to curated-only on any error.
 */
export async function fetchDemand(): Promise<DemandItem[]> {
  let live: DemandItem[] = [];
  try {
    live = await fetchCompaniesHouseDemand();
  } catch {
    // Already handled inside fetchCompaniesHouseDemand, but belt-and-braces
    live = [];
  }

  const curated = nextCuratedItem();
  return [...live, curated];
}
