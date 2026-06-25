# Hands Off — build contract

An autonomous AI agent that runs a one-person services business. It scans a public
demand feed (Reddit r/forhire), picks up small jobs it can actually do, does the
work, and collects a fee, on a loop. A live control-room dashboard shows the agents
working and revenue ticking up, with a single human-approval gate for oversight.

The demo is the spec: agents find a paid request -> draft the deliverable -> human
approves -> fee charged via PayPal sandbox -> revenue counter ticks up. Repeatedly.

## Judging criteria to hit
Agent autonomy (runs on a loop, hands off), made money (the fee), real-world
applicability, safety & oversight (the approval gate + audit log), technical
execution, UX clarity (the control room). Build to these.

## Data model (Supabase) — see supabase/schema.sql, types in lib/types.ts
- `jobs`: id, source ('reddit'), source_url, title, body, budget_text,
  status ('found'|'skipped'|'awaiting_approval'|'approved'|'charged'),
  reasoning (why fulfil/skip), deliverable (the drafted work), fee_cents,
  created_at, updated_at.
- `events`: id, agent ('scout'|'worker'|'finance'|'manager'), action, detail,
  job_id (nullable), created_at. This is the glass-box activity feed + audit log.
RLS enabled on both; all writes via the service role in server routes.

## The agent loop (server-side, lib/agents.ts)
Four roles, each logs an `event` for every action (the glass box):
- **Scout**: fetch newest r/forhire [HIRING] posts, create `jobs` (status 'found').
  Use plain fetch on https://www.reddit.com/r/forhire/new.json with a User-Agent
  header (no auth needed for public reads). Dedupe by source_url.
- **Worker** (LLM via @ai-sdk/openai): for each 'found' job, decide if an AI can
  deliver it. If yes, draft the deliverable and set status 'awaiting_approval' with
  a fee_cents (small, e.g. 50-500). If no, status 'skipped' with reasoning.
- **Manager**: surfaces 'awaiting_approval' jobs to the human (the approval queue).
- **Finance**: on 'approved', create a PayPal sandbox invoice, mark 'charged',
  record fee. (Sandbox; if PayPal not wired yet, simulate the charge but keep the
  code path real.)

## API routes
- `POST /api/agent/tick`: advance the loop one cycle (Scout fetches + Worker
  processes a batch of 'found' jobs). Idempotent-ish, safe to call repeatedly.
  The dashboard calls this on an interval so the business runs while open.
- `GET /api/dashboard`: { jobs, events, revenueCents, counts } for the UI.
- `POST /api/jobs/[id]/approve` and `/reject`: human gate. Approve -> Finance charges.
- All resilient: if Supabase/OpenAI/PayPal env missing, fall back to mock so the
  app always runs and demos.

## Control room (dashboard, the product)
One screen, polls `GET /api/dashboard` every 1500ms:
- Header: "Hands Off" + ● Running + Revenue counter + Jobs done.
- Left: the team (Scout / Worker / Finance / Manager) with live status dots.
- Center: live activity feed (events, newest first), glass box.
- Approval queue: 'awaiting_approval' jobs with the drafted deliverable preview and
  [Approve] [Reject]. This is the human oversight moment.
Brand it clean and confident. NO em dashes, no AI-slop copy.

## Safety & oversight (a judged criterion — lean in)
The agent never charges or delivers without human approval. Every action is in the
audit log. Disclose it is an AI service. Frame human-in-the-loop as the design
choice that makes autonomy safe, not a limitation.

## Stack / sponsors
Next.js + Vercel, Supabase (state + audit + realtime), OpenAI via Vercel AI SDK
(agent runtime), PayPal sandbox (the fee = made money). Built in Cursor.

## File ownership (parallel build, avoid collisions)
- BACKEND: `supabase/schema.sql`, `app/api/**`, `lib/agents.ts`, `lib/reddit.ts`,
  `lib/ai.ts`, `lib/paypal.ts`, `lib/supabase.ts`, `lib/types.ts`.
- FRONTEND: `app/page.tsx`, `app/globals.css`, `components/**`. Drives the dashboard
  from `GET /api/dashboard` + the approve/reject + tick endpoints. Prop-driven, mock
  data until the API is live.
