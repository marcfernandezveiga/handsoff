// POST /api/agent/tick  — called by the dashboard on an interval
// GET  /api/agent/tick  — called by Vercel cron (crons always use GET)
//
// Runs one Scout + Worker cycle. Safe to call repeatedly (idempotent-ish).

import { runScout, runWorker, runFinanceQueue } from "@/lib/agents";

export const dynamic = "force-dynamic";

async function runTick(): Promise<Response> {
  try {
    await runScout();
    await runWorker();
    await runFinanceQueue(); // fully autonomous: bill everything the worker approved this cycle

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

export async function POST() {
  return runTick();
}

export async function GET() {
  return runTick();
}
