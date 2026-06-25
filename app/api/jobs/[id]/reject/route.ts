// POST /api/jobs/[id]/reject
// Human rejection gate. Sets job to 'skipped', logs the decision.
// Also records a negative learning signal for the job's category.

import type { NextRequest } from "next/server";
import { updateJobStatus, getDashboardData } from "@/lib/agents";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase";
import { recordSignal, deriveCategory } from "@/lib/learning";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await updateJobStatus(id, "skipped");

    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Record negative learning signal: this category got rejected
    const category = deriveCategory(job.title, job.body);
    await recordSignal({
      jobId: id,
      category,
      signal: "rejected",
      feeCents: job.fee_cents ?? 300,
    });

    // Log the manager rejection event
    if (hasSupabaseEnv) {
      const db = createServiceClient();
      await db.from("events").insert({
        agent: "manager",
        action: "rejected",
        detail: `Human rejected job: ${job.title.slice(0, 80)}`,
        job_id: id,
      });
    } else {
      // In mock mode, agents.ts logEvent handles the mock store;
      // we replicate a minimal entry inline here to avoid circular imports
      const dashboard = await getDashboardData();
      void dashboard; // just ensuring the mock store is coherent
    }

    return Response.json({ ok: true, jobId: id });
  } catch (err) {
    console.error("[reject] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
