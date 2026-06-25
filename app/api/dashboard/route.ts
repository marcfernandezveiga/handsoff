// GET /api/dashboard
// Returns: { jobs, events, revenueCents, counts }
// Read-only — polled every 5s by the dashboard UI.

import { getDashboardData } from "@/lib/dashboard";
import type { DashboardPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const payload: DashboardPayload = await getDashboardData();
    return Response.json(payload);
  } catch (err) {
    console.error("[dashboard] error:", err);
    // Return a valid empty payload so the UI doesn't crash
    const empty: DashboardPayload = {
      jobs: [],
      events: [],
      revenueCents: 0,
      counts: { found: 0, awaiting: 0, charged: 0, skipped: 0 },
      learnings: {
        overallAcceptanceRate: 0,
        totalDecisions: 0,
        categories: [],
        recentAdjustments: [],
      },
      paused: false,
    };
    return Response.json(empty);
  }
}
