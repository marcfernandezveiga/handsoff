// Learning read layer: derives category stats from the learnings table.
// Read-only — signal recording (recordSignal) now lives in the Python Modal agent.
// Used by the dashboard to show "how it's learning" panel.

import { createServiceClient, hasSupabaseEnv } from "./supabase";

// ---------------------------------------------------------------------------
// Category derivation — simple keyword match on job title + body
// ---------------------------------------------------------------------------

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /cold.?email|outreach email|email template/i, category: "cold-emails" },
  { pattern: /summar|recap|tldr|summarise|summarize/i, category: "summary" },
  { pattern: /landing.?page|hero copy|homepage copy/i, category: "landing-copy" },
  { pattern: /research|competitive analysis|market research/i, category: "research" },
  { pattern: /data.?clean|csv|spreadsheet|data entry/i, category: "data-cleaning" },
  { pattern: /tweet|thread|twitter|x\.com/i, category: "social-content" },
  { pattern: /blog|article|post|write.?up/i, category: "blog-writing" },
  { pattern: /proofread|edit|rewrite|polish|grammar/i, category: "proofreading" },
  { pattern: /product description|product copy|ecommerce/i, category: "product-copy" },
  { pattern: /cover letter|cv|resume|job application/i, category: "career-docs" },
  { pattern: /python|javascript|script|code|function/i, category: "code-snippets" },
];

export function deriveCategory(title: string, body: string): string {
  const text = `${title} ${body}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return "general-writing";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryLearning {
  category: string;
  approved: number;
  rejected: number;
  acceptanceRate: number; // 0-1
  learnedFeeCents: number; // adjusted fee based on signals
}

export interface LearningsPayload {
  overallAcceptanceRate: number; // 0-1
  totalDecisions: number;
  categories: CategoryLearning[];
  recentAdjustments: string[]; // human-readable log lines, newest first
}

interface LearningRow {
  id: string;
  category: string;
  signal: "approved" | "rejected";
  job_id: string;
  fee_cents: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Build the full learnings payload (used by dashboard)
// ---------------------------------------------------------------------------

export async function getLearningsPayload(): Promise<LearningsPayload> {
  let rows: LearningRow[] = [];

  if (!hasSupabaseEnv) {
    rows = [];
  } else {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from("learnings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      rows = (data ?? []) as LearningRow[];
    } catch (err) {
      console.warn("[learning] getLearningsPayload failed:", err);
      rows = [];
    }
  }

  // Group by category
  const categoryMap = new Map<
    string,
    { approved: number; rejected: number; fees: number[] }
  >();

  for (const row of rows) {
    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, { approved: 0, rejected: 0, fees: [] });
    }
    const entry = categoryMap.get(row.category)!;
    if (row.signal === "approved") {
      entry.approved++;
      entry.fees.push(row.fee_cents);
    } else {
      entry.rejected++;
    }
  }

  // Build per-category summaries + adjustment log
  const categories: CategoryLearning[] = [];
  const recentAdjustments: string[] = [];

  const DEFAULT_FEE = 300; // baseline fee in cents when no learning exists

  for (const [category, data] of categoryMap.entries()) {
    const total = data.approved + data.rejected;
    const acceptanceRate = total > 0 ? data.approved / total : 0;

    // Learned fee: average of approved fees, nudged by rejection rate
    let learnedFeeCents: number;
    if (data.fees.length > 0) {
      const avgApproved =
        data.fees.reduce((a, b) => a + b, 0) / data.fees.length;
      learnedFeeCents = Math.round(
        Math.max(50, Math.min(1000, avgApproved * (0.5 + 0.5 * acceptanceRate)))
      );
    } else {
      learnedFeeCents = Math.round(DEFAULT_FEE * 0.7);
    }

    categories.push({ category, approved: data.approved, rejected: data.rejected, acceptanceRate, learnedFeeCents });

    if (total >= 1) {
      const displayCategory = category.replace(/-/g, " ");
      const price = `£${(learnedFeeCents / 100).toFixed(2)}`;
      if (acceptanceRate === 1) {
        recentAdjustments.push(
          `Prioritising ${displayCategory}, ${Math.round(acceptanceRate * 100)}% approval rate`
        );
      } else if (acceptanceRate >= 0.6) {
        recentAdjustments.push(
          `${displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1)} performing well, learned price ${price}`
        );
      } else if (data.rejected > 0 && acceptanceRate < 0.5) {
        recentAdjustments.push(
          `Lowered ${displayCategory} price to ${price} after ${data.rejected} rejection${data.rejected > 1 ? "s" : ""}`
        );
      }
    }
  }

  // Sort: best performing first
  categories.sort((a, b) => b.acceptanceRate - a.acceptanceRate);

  const totalDecisions = rows.length;
  const totalApproved = rows.filter((r) => r.signal === "approved").length;
  const overallAcceptanceRate =
    totalDecisions > 0 ? totalApproved / totalDecisions : 0;

  return {
    overallAcceptanceRate,
    totalDecisions,
    categories,
    recentAdjustments: recentAdjustments.slice(0, 5),
  };
}
