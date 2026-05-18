#!/usr/bin/env node
// Pre-build env check. Runs as the `prebuild` npm lifecycle hook, so
// `next build` aborts when a Vercel **production** deployment is
// missing a secret that would otherwise leak a security hole into the
// running app:
//
//   • BUDGET_API_KEY — without it, /api/budget GET/PUT and /api/ai/*
//     accept any anonymous request. The AI endpoints in particular
//     become a free OpenAI-cost firehose for bad actors.
//
// Non-production builds (local dev, Vercel preview, CI) skip the check
// so contributors don't need the prod secret in their .env.local.
//
// See CLAUDE.md → "Sync architecture" for the three-layer guard model.

const VERCEL_ENV = process.env.VERCEL_ENV;
const IS_PROD = VERCEL_ENV === 'production';

if (!IS_PROD) {
  process.exit(0);
}

const required = ['BUDGET_API_KEY'];
const missing = required.filter((key) => {
  const value = process.env[key];
  return !value || value.length === 0;
});

if (missing.length > 0) {
  console.error('');
  console.error('━━━ ENV CHECK FAILED ━━━');
  console.error('This production deployment is missing required secrets:');
  for (const key of missing) console.error(`  • ${key}`);
  console.error('');
  console.error('Set them via `vercel env add <key> production` or in the');
  console.error('Vercel dashboard, then redeploy. Without them, /api/budget');
  console.error('and /api/ai/* are open to anonymous reads/writes.');
  console.error('');
  process.exit(1);
}

console.log(`[check-env] ${required.length} required production secret(s) present.`);
