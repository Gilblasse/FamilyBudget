/**
 * Remote-sync policy — single source of truth for "may this runtime write
 * to the remote Supabase backend?"
 *
 * Two triggers open the write gate (either is sufficient):
 *   • Supabase credentials present (`isRemotePrimary()` in
 *     `lib/remote-mode.ts`) — the primary trigger. When the credentials
 *     are wired, remote-primary mode is active and writes are allowed.
 *   • `VERCEL_ENV=production` — kept as a defense-in-depth fallback. If a
 *     prod deploy is missing its Supabase keys, the legacy snapshot PUT
 *     in `app/api/budget/route.ts` short-circuits with `{ skipped: true }`
 *     instead of returning a confusing 502 from a downstream Supabase
 *     "not configured" error.
 *
 * Reads are always allowed so non-production environments that *do* have
 * credentials can hydrate from real data.
 *
 * NODE_ENV is intentionally NOT consulted — `next build && next start` on
 * a developer's laptop sets NODE_ENV=production but is not a deployment.
 */

import { isRemotePrimary } from './remote-mode';

export type DeploymentEnv = 'production' | 'preview' | 'development' | 'unknown';

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export function getDeploymentEnv(): DeploymentEnv {
  const raw = readEnv('VERCEL_ENV') ?? readEnv('NEXT_PUBLIC_VERCEL_ENV');
  switch (raw) {
    case 'production':
    case 'preview':
    case 'development':
      return raw;
    default:
      return 'unknown';
  }
}

export function isProductionDeployment(): boolean {
  return getDeploymentEnv() === 'production';
}

export function canWriteRemote(): boolean {
  return isRemotePrimary() || isProductionDeployment();
}

export const REMOTE_WRITE_DISABLED_REASON =
  'Remote writes require Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). ' +
  'Edits persist locally until the credentials are wired.';
