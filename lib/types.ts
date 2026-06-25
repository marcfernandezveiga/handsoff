// Shared domain types: the contract both backend and frontend build against.

export type JobStatus =
  | "found"
  | "skipped"
  | "awaiting_approval"
  | "approved"
  | "charged";

export type AgentRole = "scout" | "worker" | "finance" | "manager";

export interface Job {
  id: string;
  source: string; // 'hn' (Hacker News) | 'curated' | 'reddit' (legacy)
  source_url: string;
  title: string;
  body: string;
  budget_text: string | null;
  status: JobStatus;
  reasoning: string | null; // why the worker chose to fulfil or skip
  deliverable: string | null; // the drafted work product
  fee_cents: number | null;
  created_at: string;
  updated_at: string;
}

export interface AgentEvent {
  id: string;
  agent: AgentRole;
  action: string;
  detail: string | null;
  job_id: string | null;
  created_at: string;
}

export interface CategoryLearning {
  category: string;
  approved: number;
  rejected: number;
  acceptanceRate: number;
  learnedFeeCents: number;
}

export interface LearningsPayload {
  overallAcceptanceRate: number;
  totalDecisions: number;
  categories: CategoryLearning[];
  recentAdjustments: string[];
}

export interface DashboardPayload {
  jobs: Job[];
  events: AgentEvent[];
  revenueCents: number;
  counts: { found: number; awaiting: number; charged: number; skipped: number };
  learnings: LearningsPayload;
}
