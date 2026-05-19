/**
 * Remote-primary mode — single source of truth for "is the Supabase backend
 * the primary store, with per-entity REST mutations replacing the local
 * Zustand-first model?"
 *
 * The trigger is the presence of Supabase server-side credentials:
 *   • `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL` as a fallback for the
 *     `vercel env pull` convention that only writes the public URL)
 *   • `SUPABASE_SERVICE_ROLE_KEY`
 *
 * Both must be set. No separate named flag — wiring the credentials is
 * the opt-in. To go back to local-first (Zustand + localStorage), remove
 * those env vars.
 *
 * Distinct from `lib/remote-sync-policy.ts:canWriteRemote()`, which keeps
 * a `VERCEL_ENV=production` fallback for defense in depth (so a prod
 * deploy that loses its keys short-circuits cleanly instead of 502ing).
 */

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

function hasSupabaseCredentials(): boolean {
  const url = readEnv('SUPABASE_URL') ?? readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  return !!(url && key);
}

/**
 * Server-side check. Returns true when both a Supabase URL (server-side
 * or NEXT_PUBLIC_ fallback) and the service-role key are present.
 */
export function isRemotePrimary(): boolean {
  return hasSupabaseCredentials();
}

/**
 * Client-side check. Reads `NEXT_PUBLIC_REMOTE_PRIMARY` which is injected
 * at build time by `next.config.ts` from the same credential-presence
 * check. The service-role key itself is never bundled into the client —
 * only the boolean derived from it at build time.
 */
export function isRemotePrimaryClient(): boolean {
  return readEnv('NEXT_PUBLIC_REMOTE_PRIMARY') === '1';
}

export const REMOTE_DISABLED_REASON =
  'Per-entity remote endpoints require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
  'Set them via the Vercel Marketplace Supabase integration, `vercel env pull`, ' +
  'or .env.development.local for local dev against a local Supabase stack.';
