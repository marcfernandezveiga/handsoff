// Agent loop: Scout -> Worker -> Finance
// Every action appends an events row (the glass-box audit log).
// All operations are fail-open: errors are logged, not thrown.

import { createServiceClient, hasSupabaseEnv } from "./supabase";
import { fetchDemand } from "./demand";
import { evaluateJob } from "./ai";
import { createInvoice } from "./paypal";
import {
  deriveCategory,
  getLearnedFee,
  getCategoryAcceptanceRate,
  getLearningsPayload,
} from "./learning";
import type { Job, AgentEvent, DashboardPayload } from "./types";

// ---------------------------------------------------------------------------
// Mock in-memory store (used when Supabase env is absent)
// ---------------------------------------------------------------------------

let mockJobs: Job[] = [
  {
    id: "mock-001",
    source: "reddit",
    source_url:
      "https://www.reddit.com/r/forhire/comments/mock001/hiring_copywriter_for_landing_page",
    title: "[HIRING] Copywriter for SaaS landing page hero section",
    body: "Need 80-100 words of punchy hero copy for a time-tracking app. Budget $15, turnaround today.",
    budget_text: "$15",
    status: "awaiting_approval",
    reasoning: "Short copywriting task perfectly suited for AI text generation.",
    deliverable:
      "Track every billable minute without lifting a finger. Our time-tracking SaaS runs quietly in the background, logging hours across projects automatically. Invoice clients in one click at the end of the week. Built for freelancers who bill by the hour and have better things to do than fill in spreadsheets.",
    fee_cents: 1500,
    created_at: new Date(Date.now() - 120000).toISOString(),
    updated_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "mock-002",
    source: "reddit",
    source_url:
      "https://www.reddit.com/r/forhire/comments/mock002/hiring_tweet_thread_productivity",
    title: "[HIRING] Write a 5-tweet thread on productivity for solopreneurs",
    body: "Newsletter about solopreneur productivity. Topic: deep work at home with kids. 5 tweets, practical, no fluff. Budget $20.",
    budget_text: "$20",
    status: "charged",
    reasoning: "Short-form writing AI handles well. No proprietary knowledge needed.",
    deliverable:
      "1/ The hardest part of deep work at home isn't interruptions. It's the mental overhead of knowing they might happen.\n\n2/ Fix it with a signal. Closed door + specific lamp = Do Not Disturb. Kids learn the cue faster than you'd think.\n\n3/ Work in 45-min blocks. You can defend 45 minutes. You cannot defend your whole morning.\n\n4/ Front-load hard work before 9am. Not circadian science — just fewer people awake to need things from you.\n\n5/ The goal isn't zero interruptions. It's predictable ones. A 10am snack break you choose beats three random ones that choose you.",
    fee_cents: 2000,
    created_at: new Date(Date.now() - 240000).toISOString(),
    updated_at: new Date(Date.now() - 30000).toISOString(),
  },
];

let mockEvents: AgentEvent[] = [
  {
    id: "evt-001",
    agent: "scout",
    action: "found",
    detail: "Discovered [HIRING] post: copywriter for SaaS landing page",
    job_id: "mock-001",
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "evt-002",
    agent: "worker",
    action: "fulfilled",
    detail: "Drafted hero copy. Fee: $15.00. Awaiting human approval.",
    job_id: "mock-001",
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "evt-003",
    agent: "scout",
    action: "found",
    detail: "Discovered [HIRING] post: tweet thread for solopreneurs",
    job_id: "mock-002",
    created_at: new Date(Date.now() - 240000).toISOString(),
  },
  {
    id: "evt-004",
    agent: "worker",
    action: "fulfilled",
    detail: "Drafted 5-tweet thread. Fee: $20.00. Awaiting human approval.",
    job_id: "mock-002",
    created_at: new Date(Date.now() - 200000).toISOString(),
  },
  {
    id: "evt-005",
    agent: "finance",
    action: "charged",
    detail: "PayPal sandbox invoice SIM-INV-demo created. $20.00 collected.",
    job_id: "mock-002",
    created_at: new Date(Date.now() - 30000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function logEvent(params: {
  agent: AgentEvent["agent"];
  action: string;
  detail: string;
  job_id?: string | null;
}) {
  if (!hasSupabaseEnv) {
    mockEvents.unshift({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agent: params.agent,
      action: params.action,
      detail: params.detail,
      job_id: params.job_id ?? null,
      created_at: new Date().toISOString(),
    });
    return;
  }

  try {
    const db = createServiceClient();
    await db.from("events").insert({
      agent: params.agent,
      action: params.action,
      detail: params.detail,
      job_id: params.job_id ?? null,
    });
  } catch (err) {
    console.warn("[agents] logEvent failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Scout: fetch r/forhire, insert new [HIRING] jobs, dedupe by source_url
// ---------------------------------------------------------------------------

export async function runScout(): Promise<void> {
  await logEvent({
    agent: "scout",
    action: "started",
    detail: "Scout waking up to scan Hacker News for fresh freelance demand.",
  });

  // fetchDemand returns live HN hits plus one curated fallback item (last in
  // the array), so there is always at least one candidate. We cap HN intake per
  // tick so the queue grows steadily rather than dumping dozens at once, while
  // always keeping the trailing curated item as the reliability guarantee.
  const SCOUT_INTAKE = 6;
  const all = await fetchDemand();
  const curated = all[all.length - 1]; // fetchDemand always appends one curated item
  const hnSlice = all.slice(0, Math.max(0, all.length - 1)).slice(0, SCOUT_INTAKE - 1);
  const posts = [...hnSlice, curated];

  if (posts.length === 0) {
    await logEvent({
      agent: "scout",
      action: "no_results",
      detail: "No demand candidates returned (unexpected — curated fallback should always supply one).",
    });
    return;
  }

  let found = 0;
  let dupes = 0;

  if (!hasSupabaseEnv) {
    // Mock mode: dedupe against existing mock jobs
    for (const post of posts) {
      const exists = mockJobs.some((j) => j.source_url === post.source_url);
      if (exists) { dupes++; continue; }

      const newJob: Job = {
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: post.source,
        source_url: post.source_url,
        title: post.title,
        body: post.body,
        budget_text: post.budget_text,
        status: "found",
        reasoning: null,
        deliverable: null,
        fee_cents: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockJobs.push(newJob);

      await logEvent({
        agent: "scout",
        action: "found",
        detail: `Discovered (${post.source}): ${post.title.slice(0, 80)}`,
        job_id: newJob.id,
      });
      found++;
    }
  } else {
    const db = createServiceClient();

    for (const post of posts) {
      try {
        const { error } = await db.from("jobs").insert({
          source: post.source,
          source_url: post.source_url,
          title: post.title,
          body: post.body,
          budget_text: post.budget_text,
          status: "found",
        });

        if (error) {
          // Unique constraint violation = dupe; anything else is a real error
          if (error.code === "23505") { dupes++; continue; }
          console.warn("[scout] insert error:", error.message);
          continue;
        }

        // Fetch the inserted row to get the id
        const { data: inserted } = await db
          .from("jobs")
          .select("id")
          .eq("source_url", post.source_url)
          .single();

        await logEvent({
          agent: "scout",
          action: "found",
          detail: `Discovered (${post.source}): ${post.title.slice(0, 80)}`,
          job_id: inserted?.id ?? null,
        });
        found++;
      } catch (err) {
        console.warn("[scout] error processing post:", err);
      }
    }
  }

  await logEvent({
    agent: "scout",
    action: "complete",
    detail: `Scan complete. ${found} new jobs found, ${dupes} duplicates skipped.`,
  });
}

// ---------------------------------------------------------------------------
// Worker: process 'found' jobs, decide fulfil/skip, update status
// ---------------------------------------------------------------------------

const WORKER_BATCH = 5; // Process up to 5 jobs per tick to keep response time reasonable

export async function runWorker(): Promise<void> {
  await logEvent({
    agent: "worker",
    action: "started",
    detail: "Worker scanning for new jobs to evaluate.",
  });

  let jobs: Job[] = [];

  if (!hasSupabaseEnv) {
    jobs = mockJobs
      .filter((j) => j.status === "found")
      .slice(0, WORKER_BATCH);
  } else {
    const db = createServiceClient();
    const { data, error } = await db
      .from("jobs")
      .select("*")
      .eq("status", "found")
      .order("created_at", { ascending: true })
      .limit(WORKER_BATCH);

    if (error) {
      console.warn("[worker] fetch error:", error.message);
      return;
    }
    jobs = (data ?? []) as Job[];
  }

  if (jobs.length === 0) {
    await logEvent({
      agent: "worker",
      action: "idle",
      detail: "No 'found' jobs in queue.",
    });
    return;
  }

  for (const job of jobs) {
    try {
      // Derive category so we can apply learned signals
      const category = deriveCategory(job.title, job.body);

      // If the agent has learned this category is nearly always rejected (< 25%),
      // skip proactively and note why — this is the visible "learning" behaviour.
      const learnedRate = await getCategoryAcceptanceRate(category);
      if (learnedRate !== null && learnedRate < 0.25) {
        const skipReason = `[Learned] ${category.replace(/-/g, " ")} jobs have a ${Math.round(learnedRate * 100)}% approval rate — skipping to prioritise better-performing categories.`;
        if (!hasSupabaseEnv) {
          const idx = mockJobs.findIndex((j) => j.id === job.id);
          if (idx !== -1) {
            mockJobs[idx] = {
              ...mockJobs[idx],
              status: "skipped",
              reasoning: skipReason,
              updated_at: new Date().toISOString(),
            };
          }
        } else {
          const db = createServiceClient();
          await db.from("jobs").update({ status: "skipped", reasoning: skipReason }).eq("id", job.id);
        }
        await logEvent({
          agent: "worker",
          action: "skipped",
          detail: skipReason,
          job_id: job.id,
        });
        continue;
      }

      const result = await evaluateJob({
        title: job.title,
        body: job.body,
        budget_text: job.budget_text,
      });

      // Override fee with learned price for this category if we have one
      let finalFeeCents = result.feeCents ?? 300;
      if (result.decision === "fulfil") {
        const learnedFee = await getLearnedFee(category);
        if (learnedFee !== null) {
          finalFeeCents = learnedFee;
        }
      }

      if (!hasSupabaseEnv) {
        const idx = mockJobs.findIndex((j) => j.id === job.id);
        if (idx !== -1) {
          mockJobs[idx] = {
            ...mockJobs[idx],
            status:
              result.decision === "fulfil" ? "awaiting_approval" : "skipped",
            reasoning: result.reasoning,
            deliverable: result.deliverable ?? null,
            fee_cents: result.decision === "fulfil" ? finalFeeCents : null,
            updated_at: new Date().toISOString(),
          };
        }
      } else {
        const db = createServiceClient();
        await db
          .from("jobs")
          .update({
            status:
              result.decision === "fulfil" ? "awaiting_approval" : "skipped",
            reasoning: result.reasoning,
            deliverable: result.deliverable ?? null,
            fee_cents: result.decision === "fulfil" ? finalFeeCents : null,
          })
          .eq("id", job.id);
      }

      if (result.decision === "fulfil") {
        const usedLearnedFee = result.feeCents !== finalFeeCents;
        const priceNote = usedLearnedFee ? ` (learned price for ${category.replace(/-/g, " ")})` : "";
        await logEvent({
          agent: "worker",
          action: "fulfilled",
          detail: `Drafted deliverable. Fee: $${(finalFeeCents / 100).toFixed(2)}${priceNote}. Awaiting human approval. Reason: ${result.reasoning}`,
          job_id: job.id,
        });
      } else {
        await logEvent({
          agent: "worker",
          action: "skipped",
          detail: `Skipped: ${result.reasoning}`,
          job_id: job.id,
        });
      }
    } catch (err) {
      console.warn("[worker] error processing job:", job.id, err);
      await logEvent({
        agent: "worker",
        action: "error",
        detail: `Error processing job ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
        job_id: job.id,
      });
    }
  }

  await logEvent({
    agent: "worker",
    action: "complete",
    detail: `Worker processed ${jobs.length} job(s).`,
  });
}

// ---------------------------------------------------------------------------
// Finance: charge an approved job via PayPal, mark as 'charged'
// ---------------------------------------------------------------------------

export async function runFinance(jobId: string): Promise<void> {
  let job: Job | null = null;

  if (!hasSupabaseEnv) {
    job = mockJobs.find((j) => j.id === jobId) ?? null;
  } else {
    const db = createServiceClient();
    const { data, error } = await db
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (error || !data) {
      console.warn("[finance] job not found:", jobId);
      return;
    }
    job = data as Job;
  }

  if (!job || job.status !== "approved") {
    console.warn("[finance] job not in approved state:", jobId, job?.status);
    return;
  }

  await logEvent({
    agent: "finance",
    action: "invoicing",
    detail: `Creating PayPal sandbox invoice for: ${job.title.slice(0, 80)}`,
    job_id: jobId,
  });

  const invoice = await createInvoice({
    jobTitle: job.title,
    feeCents: job.fee_cents ?? 500,
  });

  if (!hasSupabaseEnv) {
    const idx = mockJobs.findIndex((j) => j.id === jobId);
    if (idx !== -1) {
      mockJobs[idx] = {
        ...mockJobs[idx],
        status: "charged",
        updated_at: new Date().toISOString(),
      };
    }
  } else {
    const db = createServiceClient();
    await db.from("jobs").update({ status: "charged" }).eq("id", jobId);
  }

  const simNote = invoice.simulated ? " (simulated — no PayPal credentials)" : "";
  await logEvent({
    agent: "finance",
    action: "charged",
    detail: `Invoice ${invoice.invoiceId} created${simNote}. $${((job.fee_cents ?? 0) / 100).toFixed(2)} collected.`,
    job_id: jobId,
  });
}

// ---------------------------------------------------------------------------
// Dashboard data read
// ---------------------------------------------------------------------------

export async function getDashboardData(): Promise<DashboardPayload> {
  if (!hasSupabaseEnv) {
    const revenueCents = mockJobs
      .filter((j) => j.status === "charged")
      .reduce((sum, j) => sum + (j.fee_cents ?? 0), 0);

    const learnings = await getLearningsPayload();

    return {
      jobs: [...mockJobs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      events: [...mockEvents].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      revenueCents,
      counts: {
        found: mockJobs.filter((j) => j.status === "found").length,
        awaiting: mockJobs.filter((j) => j.status === "awaiting_approval").length,
        charged: mockJobs.filter((j) => j.status === "charged").length,
        skipped: mockJobs.filter((j) => j.status === "skipped").length,
      },
      learnings,
    };
  }

  const db = createServiceClient();

  const [jobsRes, eventsRes, learnings] = await Promise.all([
    db.from("jobs").select("*").order("created_at", { ascending: false }),
    db
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    getLearningsPayload(),
  ]);

  const jobs = (jobsRes.data ?? []) as Job[];
  const events = (eventsRes.data ?? []) as AgentEvent[];

  const revenueCents = jobs
    .filter((j) => j.status === "charged")
    .reduce((sum, j) => sum + (j.fee_cents ?? 0), 0);

  return {
    jobs,
    events,
    revenueCents,
    counts: {
      found: jobs.filter((j) => j.status === "found").length,
      awaiting: jobs.filter((j) => j.status === "awaiting_approval").length,
      charged: jobs.filter((j) => j.status === "charged").length,
      skipped: jobs.filter((j) => j.status === "skipped").length,
    },
    learnings,
  };
}

// ---------------------------------------------------------------------------
// updateJobStatus: used by approve/reject endpoints
// ---------------------------------------------------------------------------

export async function updateJobStatus(
  jobId: string,
  status: "approved" | "skipped"
): Promise<Job | null> {
  if (!hasSupabaseEnv) {
    const idx = mockJobs.findIndex((j) => j.id === jobId);
    if (idx === -1) return null;
    mockJobs[idx] = {
      ...mockJobs[idx],
      status,
      updated_at: new Date().toISOString(),
    };
    return mockJobs[idx];
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .select()
    .single();

  if (error) {
    console.warn("[agents] updateJobStatus error:", error.message);
    return null;
  }
  return data as Job;
}
