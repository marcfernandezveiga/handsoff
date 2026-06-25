// Worker LLM: decide whether an AI can fulfil a job, and if so draft the deliverable.
//
// Inference priority:
//   1. Modal-hosted Qwen2.5-7B-Instruct  (MODAL_LLM_BASE_URL + MODAL_LLM_API_KEY + MODAL_LLM_MODEL)
//   2. OpenAI gpt-4o-mini                (OPENAI_API_KEY)
//   3. Mock decision                     (always available, demo fallback)
//
// Required env vars for Modal (add to .env.local and Vercel):
//   MODAL_LLM_BASE_URL=https://<workspace>--handsoff-llm-serve.modal.run/v1
//   MODAL_LLM_API_KEY=handsoff-demo-key-2024
//   MODAL_LLM_MODEL=Qwen/Qwen2.5-7B-Instruct

import { generateObject } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";

export interface WorkerDecision {
  decision: "fulfil" | "skip";
  reasoning: string;
  deliverable?: string;
  feeCents?: number;
}

const MOCK_FULFIL: WorkerDecision = {
  decision: "fulfil",
  reasoning:
    "[MOCK — no LLM key] This looks like a writing task an AI can handle well.",
  deliverable:
    "Here is a professionally drafted response to your request. This demo deliverable shows the format the real AI worker would produce.",
  feeCents: 500,
};

const MOCK_SKIP: WorkerDecision = {
  decision: "skip",
  reasoning:
    "[MOCK — no LLM key] This job appears to require in-person presence or specialist expertise beyond AI capability.",
};

const hasModal = !!(
  process.env.MODAL_LLM_BASE_URL &&
  process.env.MODAL_LLM_API_KEY &&
  process.env.MODAL_LLM_MODEL
);

const hasOpenAI = !!process.env.OPENAI_API_KEY;

function buildPrompt(job: {
  title: string;
  body: string;
  budget_text: string | null;
}): string {
  return `You are an autonomous AI agent that runs a small services business.
A potential client posted the following job on Reddit r/forhire.

Title: ${job.title}
Budget: ${job.budget_text ?? "not specified"}
Description:
${job.body.slice(0, 1200)}

Your job is to decide:
1. Can an AI (text generation only, no browsing, no code execution, no calls) deliver a complete, valuable result for this job within minutes?
2. If yes, draft the actual deliverable right now — the real output the client asked for.
3. Propose a fee in cents (50 to 500) that is fair for the work done.

Good AI jobs: writing, proofreading, copywriting, summaries, templates, emails, tweets, bios, product descriptions, simple code snippets, advice.
Bad AI jobs: anything requiring in-person work, unique personal knowledge, ongoing relationships, phone calls, design with specific brand assets.

Respond with a JSON object matching this exact schema:
{
  "decision": "fulfil" | "skip",
  "reasoning": "1-2 sentence explanation of why",
  "deliverable": "the actual work product (only if decision is fulfil; write the real thing, not a description of it)",
  "feeCents": number between 50 and 500 (only if decision is fulfil)
}`;
}

function parseDecision(obj: Record<string, unknown>): WorkerDecision {
  const decision = obj.decision === "fulfil" ? "fulfil" : "skip";
  const reasoning =
    typeof obj.reasoning === "string" ? obj.reasoning : "No reasoning provided.";

  if (decision === "fulfil") {
    const deliverable =
      typeof obj.deliverable === "string" ? obj.deliverable : "";
    const rawFee = Number(obj.feeCents);
    const feeCents = Number.isFinite(rawFee)
      ? Math.max(50, Math.min(500, rawFee))
      : 200;
    return { decision, reasoning, deliverable, feeCents };
  }

  return { decision: "skip", reasoning };
}

/** Worker agent: evaluate a job and optionally draft the deliverable. */
export async function evaluateJob(job: {
  title: string;
  body: string;
  budget_text: string | null;
}): Promise<WorkerDecision> {
  const prompt = buildPrompt(job);

  // ── 1. Modal (preferred — sponsor inference, no cold starts with min_containers=1) ──
  if (hasModal) {
    try {
      const modalProvider = createOpenAI({
        baseURL: process.env.MODAL_LLM_BASE_URL!,
        apiKey: process.env.MODAL_LLM_API_KEY!,
      });

      const result = await generateObject({
        model: modalProvider(process.env.MODAL_LLM_MODEL!),
        output: "no-schema",
        prompt,
      });

      return parseDecision(result.object as Record<string, unknown>);
    } catch (modalErr) {
      // Cold-start timeout, GPU OOM, or any Modal error → fall through to OpenAI
      console.warn(
        "[ai] Modal inference failed, falling back to OpenAI:",
        modalErr instanceof Error ? modalErr.message : String(modalErr)
      );
    }
  }

  // ── 2. OpenAI (silent fallback — keeps demo alive if Modal hiccups) ────────
  if (hasOpenAI) {
    try {
      const result = await generateObject({
        model: openai("gpt-4o-mini"),
        output: "no-schema",
        prompt,
      });

      return parseDecision(result.object as Record<string, unknown>);
    } catch (err) {
      console.warn("[ai] OpenAI generateObject failed:", err);
      // Fail-open: skip the job rather than crashing the loop
      return {
        decision: "skip",
        reasoning: `AI worker encountered an error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── 3. Mock (no keys configured) ──────────────────────────────────────────
  // Simulate 70/30 fulfil/skip for demo variety
  return Math.random() > 0.3 ? MOCK_FULFIL : MOCK_SKIP;
}
