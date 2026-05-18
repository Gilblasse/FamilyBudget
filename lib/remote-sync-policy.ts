/**
 * Remote-sync policy — single source of truth for "may this runtime write
 * to the remote Sheets/Apps Script backend?"
 *
 * Hard rule (CLAUDE.md): only production Vercel deployments perform remote
 * WRITES. Reads are always allowed so non-production environments can
 * hydrate from real data without mutating it.
 *
 * Server reads `VERCEL_ENV` (set automatically by Vercel). Client reads
 * `NEXT_PUBLIC_VERCEL_ENV` (inlined at build time; mirrors `VERCEL_ENV`).
 * If neither resolves to `'production'`, writes are blocked.
 *
 * NODE_ENV is intentionally NOT consulted — `next build && next start` on
 * a developer's laptop sets NODE_ENV=production but is not a production
 * deployment.
 */

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
  return isProductionDeployment();
}

export const REMOTE_WRITE_DISABLED_REASON =
  'Remote writes are production-only. Edits persist locally; the Sheets backend is read-only outside production.';
