// POST /api/jobs/[id]/approve
// Human approval gate. Sets job to 'approved' then immediately triggers Finance to charge.
// Also records a positive learning signal for the job's category.

import type { NextRequest } from "next/server";
import { updateJobStatus, runFinance } from "@/lib/agents";
import { recordSignal, deriveCategory } from "@/lib/learning";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await updateJobStatus(id, "approved");

    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Record positive learning signal: this category + fee got approved
    const category = deriveCategory(job.title, job.body);
    await recordSignal({
      jobId: id,
      category,
      signal: "approved",
      feeCents: job.fee_cents ?? 300,
    });

    // Finance agent: create invoice and mark 'charged'
    await runFinance(id);

    return Response.json({ ok: true, jobId: id });
  } catch (err) {
    console.error("[approve] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
