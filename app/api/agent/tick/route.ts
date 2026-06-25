// POST /api/agent/tick
// Runs one Scout + Worker cycle. Safe to call repeatedly (idempotent-ish).
// The dashboard calls this on an interval so the business runs while open.

import { runScout, runWorker } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await runScout();
    await runWorker();

    return Response.json({ ok: true });
  } catch (err) {
    // Fail-open: return 200 so the dashboard keeps polling
    console.error("[tick] unhandled error:", err);
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
