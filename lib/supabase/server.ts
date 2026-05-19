/**
 * Server-only Supabase client. Uses the service-role key, so it MUST NOT be
 * imported from any client-side module. The trust boundary stays
 * "same-origin browser -> Next.js server -> Supabase"; the browser never sees
 * a Supabase client and never holds a Supabase key.
 *
 * Provisioning: the Supabase Vercel Marketplace integration auto-wires
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into the project's env vars.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;
let cachedKey: string | null = null;

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export class SupabaseNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Supabase not configured — missing env: ${missing.join(', ')}`);
    this.name = 'SupabaseNotConfiguredError';
  }
}

export function getSupabase(): SupabaseClient {
  // Prefer SUPABASE_URL (server-side, set by the Vercel Marketplace integration)
  // and fall back to NEXT_PUBLIC_SUPABASE_URL so `vercel env pull` users don't
  // need to duplicate the URL into a second var. The URL itself isn't a secret;
  // only the service-role key is.
  const url = readEnv('SUPABASE_URL') ?? readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) throw new SupabaseNotConfiguredError(missing);

  // Invalidate the cache when the key rotates (test envs stub it per-case).
  if (cached && cachedKey === key) return cached;
  cached = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cachedKey = key!;
  return cached;
}

/**
 * Test-only hook to reset the cached client. Production code paths never need
 * to call this; vitest tests call it between cases when stubbing env vars.
 */
export function __resetSupabaseClientForTests(): void {
  cached = null;
  cachedKey = null;
}
