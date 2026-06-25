// Read-only dashboard data layer.
// All functions are pure SELECTs against Supabase — no writes, no mocks.
// If the Supabase env is missing, each function returns an honest empty payload.

import { createServiceClient, hasSupabaseEnv } from "./supabase";
import { getLearningsPayload } from "./learning";
import type { Job, AgentEvent, DashboardPayload } from "./types";

export async function getDashboardData(): Promise<DashboardPayload> {
  if (!hasSupabaseEnv) {
    return {
      jobs: [],
      events: [],
      revenueCents: 0,
      invoicedCents: 0,
      earnedCents: 0,
      counts: { found: 0, awaiting: 0, charged: 0, skipped: 0 },
      learnings: {
        overallAcceptanceRate: 0,
        totalDecisions: 0,
        categories: [],
        recentAdjustments: [],
      },
      paused: false,
    };
  }

  const db = createServiceClient();

  const [jobsRes, eventsRes, learnings, controlRes] = await Promise.all([
    db.from("jobs").select("*").order("created_at", { ascending: false }),
    db
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    getLearningsPayload(),
    db.from("agent_control").select("paused").eq("id", 1).maybeSingle(),
  ]);

  const jobs = (jobsRes.data ?? []) as Job[];
  const events = (eventsRes.data ?? []) as AgentEvent[];
  const paused = (controlRes.data as { paused: boolean } | null)?.paused ?? false;

  const revenueCents = jobs
    .filter((j) => j.status === "charged")
    .reduce((sum, j) => sum + (j.fee_cents ?? 0), 0);

  // invoicedCents = all billed (charged) regardless of payment status
  const invoicedCents = revenueCents;

  // earnedCents = only jobs confirmed paid via PayPal
  const earnedCents = jobs
    .filter((j) => j.paid === true)
    .reduce((sum, j) => sum + (j.paid_cents ?? 0), 0);

  return {
    jobs,
    events,
    revenueCents,
    invoicedCents,
    earnedCents,
    counts: {
      found: jobs.filter((j) => j.status === "found").length,
      awaiting: jobs.filter((j) => j.status === "awaiting_approval").length,
      charged: jobs.filter((j) => j.status === "charged").length,
      skipped: jobs.filter((j) => j.status === "skipped").length,
    },
    learnings,
    paused,
  };
}
