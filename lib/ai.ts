// Worker LLM: decide whether an AI can fulfil a job, and if so draft the deliverable.
// Uses Vercel AI SDK generateObject with gpt-4o-mini.
// Falls back to a mock decision if OPENAI_API_KEY is missing.

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

export interface WorkerDecision {
  decision: "fulfil" | "skip";
  reasoning: string;
  deliverable?: string;
  feeCents?: number;
}

const MOCK_FULFIL: WorkerDecision = {
  decision: "fulfil",
  reasoning:
    "[MOCK — no OPENAI_API_KEY] This looks like a writing task an AI can handle well.",
  deliverable:
    "Here is a professionally drafted response to your request. This demo deliverable shows the format the real AI worker would produce.",
  feeCents: 500,
};

const MOCK_SKIP: WorkerDecision = {
  decision: "skip",
  reasoning:
    "[MOCK — no OPENAI_API_KEY] This job appears to require in-person presence or specialist expertise beyond AI capability.",
};

const hasOpenAI = !!process.env.OPENAI_API_KEY;

/** Worker agent: evaluate a job and optionally draft the deliverable. */
export async function evaluateJob(job: {
  title: string;
  body: string;
  budget_text: string | null;
}): Promise<WorkerDecision> {
  if (!hasOpenAI) {
    // Simulate 70/30 fulfil/skip for demo variety
    return Math.random() > 0.3 ? MOCK_FULFIL : MOCK_SKIP;
  }

  try {
    const prompt = `You are an autonomous AI agent that runs a small services business.
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

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      output: "no-schema",
      prompt,
    });

    const obj = result.object as Record<string, unknown>;

    const decision = obj.decision === "fulfil" ? "fulfil" : "skip";
    const reasoning =
      typeof obj.reasoning === "string"
        ? obj.reasoning
        : "No reasoning provided.";

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
  } catch (err) {
    console.warn("[ai] generateObject failed:", err);
    // Fail-open: skip the job rather than crashing the loop
    return {
      decision: "skip",
      reasoning: `AI worker encountered an error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
