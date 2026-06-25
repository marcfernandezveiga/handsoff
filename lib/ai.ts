// Worker LLM: receive a Companies House filing lead and draft a personalised reminder.
//
// The output includes:
//   - A friendly reminder that accounts are due on <date>
//   - The penalty band they risk if late (the £ figure)
//   - A short prep checklist of what to file
//   - A service fee between 2000–5000 cents
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
    "[MOCK — no LLM key] Filing reminder drafted for this company based on their upcoming deadline.",
  deliverable:
    "Your accounts are due soon. To avoid a late filing penalty, you will need to submit your profit & loss statement, balance sheet, director's report, and notes to the accounts. We can handle the paperwork so you avoid any fines.",
  feeCents: 3000,
};

const MOCK_SKIP: WorkerDecision = {
  decision: "skip",
  reasoning:
    "[MOCK — no LLM key] This lead does not meet the criteria for a filing reminder service.",
};

const hasModal = !!(
  process.env.MODAL_LLM_BASE_URL &&
  process.env.MODAL_LLM_API_KEY &&
  process.env.MODAL_LLM_MODEL
);

const hasOpenAI = !!process.env.OPENAI_API_KEY;

/** Random fee between 2000 and 5000 cents. */
function randomFeeCents(): number {
  return Math.floor(Math.random() * 3001) + 2000;
}

function buildPrompt(job: {
  title: string;
  body: string;
  budget_text: string | null;
}): string {
  return `You are an autonomous agent that helps UK small businesses avoid late filing penalties at Companies House.

A company has been flagged with an upcoming or overdue accounts filing deadline. Your job is to draft a personalised, helpful filing reminder on behalf of a professional filing service.

Company lead:
Title: ${job.title}
Details:
${job.body.slice(0, 1200)}

Draft a filing reminder that includes ALL of the following:
1. A friendly, direct note that their accounts are due on the stated date (or are already overdue by X days).
2. The specific penalty they risk if they do not file on time — quote the £ figure from the lead details.
3. A short, practical checklist of what they need to prepare: profit & loss statement, balance sheet, director's report, notes to the accounts, and any relevant supplementary schedules.
4. A brief, no-pressure offer to help them get filed on time.

Tone: direct, practical, and helpful. Not salesy. Not corporate. Write like a knowledgeable friend who knows the rules.

Banned words — do not use any of these: seamless, elevate, leverage, synergy, game-changer, cutting-edge, transform, unlock, empower.

Respond with a JSON object matching this exact schema:
{
  "decision": "fulfil",
  "reasoning": "1-2 sentences on why this lead is worth pursuing",
  "deliverable": "the full filing reminder text, written directly to the company director",
  "feeCents": a number between 2000 and 5000
}

Always set decision to "fulfil" for Companies House leads — every company with an overdue or imminent deadline is a valid prospect.`;
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
      ? Math.max(2000, Math.min(5000, rawFee))
      : randomFeeCents();
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
  // For Companies House leads, almost always fulfil — every deadline is actionable
  const mockResult = Math.random() > 0.1 ? { ...MOCK_FULFIL } : MOCK_SKIP;
  if (mockResult.decision === "fulfil") {
    mockResult.feeCents = randomFeeCents();
  }
  return mockResult;
}
