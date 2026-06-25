// GET  /api/control  — returns { paused: boolean }
// POST /api/control  — body: { paused: boolean } (explicit set) or {} (toggle)
//
// Uses the service-role client (server-side only). The agent_control table has
// a single row (id=1). We create it defensively on first write.

import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ENSURE_ROW_SQL = `
  create table if not exists agent_control (
    id int primary key,
    paused boolean not null default false,
    updated_at timestamptz default now()
  );
  insert into agent_control (id, paused) values (1, false)
  on conflict (id) do nothing;
`.trim();

async function ensureControlRow() {
  const db = createServiceClient();
  // Run raw SQL via rpc if available, otherwise just do an upsert —
  // the table must already exist for that to work. We try the upsert
  // approach and fall back silently; the backend agent owns DDL.
  await db
    .from("agent_control")
    .upsert({ id: 1, paused: false }, { onConflict: "id", ignoreDuplicates: true });
}

export async function GET(): Promise<Response> {
  if (!hasSupabaseEnv) {
    return Response.json({ paused: false });
  }

  const db = createServiceClient();
  const { data } = await db
    .from("agent_control")
    .select("paused")
    .eq("id", 1)
    .maybeSingle();

  return Response.json({ paused: (data as { paused: boolean } | null)?.paused ?? false });
}

export async function POST(req: Request): Promise<Response> {
  if (!hasSupabaseEnv) {
    return Response.json({ paused: false });
  }

  const db = createServiceClient();

  // Parse body — optional explicit { paused: boolean }, else toggle
  let body: { paused?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — means "toggle"
  }

  await ensureControlRow();

  let nextPaused: boolean;

  if (typeof body.paused === "boolean") {
    // Explicit set
    nextPaused = body.paused;
  } else {
    // Toggle: read current state first
    const { data } = await db
      .from("agent_control")
      .select("paused")
      .eq("id", 1)
      .maybeSingle();
    const current = (data as { paused: boolean } | null)?.paused ?? false;
    nextPaused = !current;
  }

  const { error } = await db
    .from("agent_control")
    .update({ paused: nextPaused, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) {
    console.error("[control] update error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ paused: nextPaused });
}
