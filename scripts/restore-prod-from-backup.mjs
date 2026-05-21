#!/usr/bin/env node
// One-shot: restore prod from a prod-backup-*.json file produced by
// scripts/seed-prod-template.mjs (or this script).
//
// Same safety contract as the seed script:
//   - refuses without --confirm
//   - requires --file=<path>
//   - writes a fresh pre-restore safety backup before the RPC call

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadDotEnvLocal } from './_lib/env.mjs';
import { buildBudgetDataMap } from './_lib/shape-snapshot.mjs';

const STORE_VERSION = 10;

loadDotEnvLocal();

function getFileArg() {
  const arg = process.argv.find((a) => a.startsWith('--file='));
  if (!arg) {
    console.error('Required: --file=path/to/prod-backup-*.json');
    process.exit(2);
  }
  return arg.slice('--file='.length);
}

// Reshape raw DB rows from the backup into a BudgetSnapshot ready for the
// replace_budget_snapshot RPC.
function shapeSnapshot(backup) {
  let map;
  try {
    map = buildBudgetDataMap(backup);
  } catch (e) {
    console.error(`Backup is malformed: ${e.message}`);
    process.exit(2);
  }
  const { activeBudgetId, budgetMetas, budgetData } = map;
  const activeSlice = budgetData[activeBudgetId];
  if (!activeSlice) {
    console.error(`No active budget slice found for id "${activeBudgetId}"`);
    process.exit(2);
  }
  return {
    ...activeSlice,
    budgets: budgetMetas,
    activeBudgetId,
    budgetData,
  };
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without --confirm. This rewrites PROD data.');
    console.error('Re-run: node scripts/restore-prod-from-backup.mjs --confirm --file=<path>');
    process.exit(2);
  }
  const filePath = resolve(process.cwd(), getFileArg());
  if (!existsSync(filePath)) {
    console.error(`Backup file not found: ${filePath}`);
    process.exit(2);
  }

  const backup = JSON.parse(readFileSync(filePath, 'utf8'));
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(2);
  }

  console.log(`→ Target: ${url}`);
  console.log(`→ Restoring from: ${filePath}`);
  console.log(
    `  (${backup.budgets?.length ?? 0} budgets, ${backup.periods?.length ?? 0} periods, ` +
      `${backup.income?.length ?? 0} income, ${backup.bills?.length ?? 0} bills, ` +
      `${backup.paid?.length ?? 0} paid rows)`,
  );

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Pre-restore safety backup
  console.log('→ Capturing pre-restore safety backup…');
  const [m, b, p, i, bi, pd] = await Promise.all([
    supabase.from('app_meta').select('*').eq('id', 1).maybeSingle(),
    supabase.from('budgets').select('*'),
    supabase.from('periods').select('*'),
    supabase.from('income').select('*'),
    supabase.from('bills').select('*'),
    supabase.from('paid_state').select('*'),
  ]);
  for (const [name, res] of Object.entries({ m, b, p, i, bi, pd })) {
    if (res.error) {
      console.error(`✗ Read ${name} failed:`, res.error);
      process.exit(1);
    }
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyPath = resolve(process.cwd(), `prod-backup-${ts}.json`);
  writeFileSync(
    safetyPath,
    JSON.stringify(
      {
        meta: m.data,
        budgets: b.data ?? [],
        periods: p.data ?? [],
        income: i.data ?? [],
        bills: bi.data ?? [],
        paid: pd.data ?? [],
      },
      null,
      2,
    ),
  );
  console.log(`✓ Pre-restore safety backup → ${safetyPath}`);

  // Shape backup → snapshot
  const snapshot = shapeSnapshot(backup);

  // Atomic replace
  console.log('→ Writing restored snapshot via replace_budget_snapshot…');
  const { error: rpcError } = await supabase.rpc('replace_budget_snapshot', {
    payload: { version: STORE_VERSION, data: snapshot },
  });
  if (rpcError) {
    console.error('✗ RPC failed:', rpcError);
    console.error('  Safety backup intact at:', safetyPath);
    process.exit(1);
  }

  // Verify
  const [ic, bc, pc] = await Promise.all([
    supabase.from('income').select('id', { count: 'exact', head: true }),
    supabase.from('bills').select('id', { count: 'exact', head: true }),
    supabase.from('paid_state').select('key', { count: 'exact', head: true }),
  ]);
  const expectedPaid = backup.paid?.filter((x) => x.paid).length ?? 0;
  console.log(`✓ Restored. Now:     income=${ic.count}, bills=${bc.count}, paid=${pc.count}`);
  console.log(
    `  Expected from file: income=${backup.income?.length ?? 0}, bills=${backup.bills?.length ?? 0}, paid=${expectedPaid}`,
  );
  if (ic.count !== backup.income?.length || bc.count !== backup.bills?.length || pc.count !== expectedPaid) {
    console.warn('⚠ Counts mismatch — review before considering rollback complete.');
  }
  console.log('');
  console.log('Refresh the deployed app to confirm restored data.');
}

main().catch((e) => {
  console.error('✗ Unhandled error:', e);
  process.exit(1);
});
