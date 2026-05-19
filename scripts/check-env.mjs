#!/usr/bin/env node
// Pre-build env check. Runs as the `prebuild` npm lifecycle hook. Fires
// only on real production deploys (VERCEL_ENV=production) and requires
// the Supabase server-side credentials to be present — otherwise every
// per-entity /api/budget/* request would 502.
//
// Local dev / Vercel preview / CI skip the check so contributors don't
// need production secrets in .env.local.

const IS_PROD_DEPLOY = process.env.VERCEL_ENV === 'production';

if (!IS_PROD_DEPLOY) {
  process.exit(0);
}

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((key) => {
  const value = process.env[key];
  return !value || value.length === 0;
});

if (missing.length > 0) {
  console.error('');
  console.error('━━━ ENV CHECK FAILED ━━━');
  console.error('Production deploy (VERCEL_ENV=production) is missing required env vars:');
  for (const key of missing) console.error(`  • ${key}`);
  console.error('');
  console.error('Install the Supabase Vercel Marketplace integration, or set');
  console.error('them manually via `vercel env add <key> production`, then');
  console.error('redeploy.');
  console.error('');
  process.exit(1);
}

console.log(`[check-env] ${required.length} required env var(s) present.`);
