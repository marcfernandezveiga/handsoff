import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const hasSupabaseEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Browser (anon) client, safe in Client Components. RLS applies. */
export function createBrowserClient() {
  return _createBrowserClient(url, anon);
}

/** Server-side client using the service role. Bypasses RLS. Route handlers only. */
export function createServiceClient() {
  return createClient(url, service, { auth: { persistSession: false } });
}
