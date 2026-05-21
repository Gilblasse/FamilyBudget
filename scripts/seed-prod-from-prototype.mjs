#!/usr/bin/env node
// One-shot: transform a prototype-shaped JSON file (budget.jsx DEFAULT_DATA
// shape) into a family-budget BudgetSnapshot, then write it to prod via the
// replace_budget_snapshot RPC.
//
// Safety contract identical to the seed/restore scripts:
//   - --confirm required to write; without it, prints a preview + exits.
//   - --prototype=<path> required.
//   - Always writes the transformed snapshot to disk as
//     `prototype-snapshot-preview-<timestamp>.json` for inspection.
//   - When --confirm is set, captures a pre-write safety backup of current
//     prod before calling the RPC.
//
// Period semantics: any input from prod's existing active budget id is reused
// (so the second budget, if present, is preserved verbatim). The active
// budget's period is updated to PERIOD_START..PERIOD_END from the args (or
// the defaults below).

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadDotEnvLocal } from './_lib/env.mjs';
import { buildBudgetDataMap } from './_lib/shape-snapshot.mjs';

const STORE_VERSION = 10;
const PERIOD_START = '2026-05-19';
const PERIOD_END = '2026-06-10';
const YEAR = 2026;

// Category id → priority. Unknown (custom) categories fall back to 'opt' with
// a warning so typos like 'Housing' (capital H) don't silently demote a row.
const CATEGORY_PRIORITY = {
  housing: 'crit',
  transportation: 'imp',
  food: 'imp',
  utilities: 'crit',
  giving: 'opt',
  saving: 'opt',
  debt: 'crit',
  insurance: 'crit',
  misc: 'opt',
  fun: 'opt',
};

loadDotEnvLocal();

function getArg(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

// "05/20" / "5/20" / "05/19" → "2026-05-20". Empty/missing → null.
// Warns if the parsed ISO date falls outside [PERIOD_START, PERIOD_END] —
// catches typos like "12/01" silently producing a date months away.
function parseProtoDate(s, contextLabel) {
  if (!s || typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const mm = String(parseInt(m[1], 10)).padStart(2, '0');
  const dd = String(parseInt(m[2], 10)).padStart(2, '0');
  const iso = `${YEAR}-${mm}-${dd}`;
  if (iso < PERIOD_START || iso > PERIOD_END) {
    console.warn(`  ⚠ Date ${iso} for "${contextLabel}" is outside period ${PERIOD_START}..${PERIOD_END}`);
  }
  return iso;
}

function toNumber(s) {
  if (s === '' || s === null || s === undefined) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function transformAdjustments(arr) {
  if (!Array.isArray(arr)) return undefined;
  const cleaned = arr
    .filter((a) => a && a.amount !== '' && a.amount !== null && a.amount !== undefined)
    .map((a) => ({
      id: a.id || randomUUID(),
      amount: toNumber(a.amount),
      ...(a.note ? { note: String(a.note) } : {}),
    }))
    .filter((a) => Number.isFinite(a.amount) && a.amount !== 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function transformIncome(proto, periodId, fallbackDate) {
  return (proto.income ?? []).map((r) => {
    const date = parseProtoDate(r.date, r.name || r.id) ?? fallbackDate;
    const adj = transformAdjustments(r.adjustment);
    return {
      id: r.id || randomUUID(),
      periodId,
      source: r.name || '',
      date,
      amount: toNumber(r.planned),
      status: 'expected',
      cadence: 'once',
      ...(adj ? { adjustments: adj } : {}),
    };
  });
}

function transformBills(proto, periodId, fallbackDate) {
  const bills = [];
  for (const cat of proto.categories ?? []) {
    const knownPriority = CATEGORY_PRIORITY[cat.id];
    if (knownPriority === undefined && (cat.items ?? []).some((i) => (i.name || '').trim())) {
      console.warn(`  ⚠ Unknown category "${cat.id}" — defaulting all rows to priority 'opt'`);
    }
    const priority = knownPriority ?? 'opt';
    for (const item of cat.items ?? []) {
      const name = (item.name || '').trim();
      if (!name) continue;
      const date = parseProtoDate(item.date, name) ?? fallbackDate;
      const adj = transformAdjustments(item.adjustment);
      bills.push({
        id: item.id || randomUUID(),
        periodId,
        name,
        date,
        amount: toNumber(item.planned),
        priority,
        action: 'pay-full',
        tags: [cat.id],
        ...(adj ? { adjustments: adj } : {}),
      });
    }
  }
  return bills;
}


async function main() {
  const protoPath = getArg('--prototype=');
  if (!protoPath) {
    console.error('Required: --prototype=path/to/prototype-data.json');
    process.exit(2);
  }
  const protoAbs = resolve(process.cwd(), protoPath);
  if (!existsSync(protoAbs)) {
    console.error(`Prototype file not found: ${protoAbs}`);
    process.exit(2);
  }
  const proto = JSON.parse(readFileSync(protoAbs, 'utf8'));

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(2);
  }
  console.log(`→ Target: ${url}`);
  const isWrite = process.argv.includes('--confirm');
  console.log(`→ Mode:   ${isWrite ? 'WRITE (--confirm set)' : 'DRY RUN (no --confirm)'}`);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Read prod
  console.log('→ Reading current prod (to preserve non-active budgets)…');
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
  const rawProd = {
    meta: m.data,
    budgets: b.data ?? [],
    periods: p.data ?? [],
    income: i.data ?? [],
    bills: bi.data ?? [],
    paid: pd.data ?? [],
  };
  let shaped;
  try {
    shaped = buildBudgetDataMap(rawProd);
  } catch (e) {
    console.error(`✗ Prod read malformed: ${e.message}`);
    process.exit(1);
  }
  const activeBudgetId = shaped.activeBudgetId;
  const activeMeta = shaped.budgetMetas.find((x) => x.id === activeBudgetId);
  if (!activeMeta) {
    console.error('No active budget found in prod. Aborting.');
    process.exit(1);
  }
  console.log(`→ Active budget: "${activeMeta.name}" (${activeBudgetId})`);
  console.log(`→ Other budgets to preserve: ${shaped.budgetMetas.length - 1}`);

  // Build the new active-budget slice from the prototype data
  const oldActivePeriodId =
    shaped.budgetData[activeBudgetId]?.activePeriodId ?? `period-${randomUUID()}`;
  const newPeriod = {
    id: oldActivePeriodId,
    startDate: PERIOD_START,
    endDate: PERIOD_END,
  };
  const fallbackDate = PERIOD_START;
  const newIncome = transformIncome(proto, oldActivePeriodId, fallbackDate);
  const newBills = transformBills(proto, oldActivePeriodId, fallbackDate);
  const newBalance = toNumber(proto.startingBalance);

  // Build the full snapshot. Active slice = top-level fields; other budgets
  // remain in budgetData unchanged.
  const newActiveSlice = {
    balance: newBalance,
    income: newIncome,
    bills: newBills,
    paid: {},
    periods: [newPeriod],
    activePeriodId: oldActivePeriodId,
    dateRange: null,
  };
  const updatedBudgetData = { ...shaped.budgetData };
  // Active slice is conveyed via top-level fields per the RPC contract, so we
  // remove the active slice from budgetData (the RPC promotes top-level →
  // budgetData[activeId] when the latter is empty).
  delete updatedBudgetData[activeBudgetId];

  // Update activeMeta's defaultRange to the new period bounds so the budget's
  // "default" matches what's now in it.
  const updatedBudgetMetas = shaped.budgetMetas.map((bm) =>
    bm.id === activeBudgetId
      ? { ...bm, defaultRange: { start: PERIOD_START, end: PERIOD_END } }
      : bm,
  );

  const snapshot = {
    ...newActiveSlice,
    budgets: updatedBudgetMetas,
    activeBudgetId,
    budgetData: updatedBudgetData,
  };

  // Always write preview to disk for inspection
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const previewPath = resolve(process.cwd(), `prototype-snapshot-preview-${ts}.json`);
  writeFileSync(previewPath, JSON.stringify({ version: STORE_VERSION, data: snapshot }, null, 2));
  console.log(`✓ Snapshot preview → ${previewPath}`);

  // Summary
  console.log('');
  console.log('--- Snapshot summary ---');
  console.log(`Active budget:     "${activeMeta.name}" (${activeBudgetId})`);
  console.log(`Period:            ${PERIOD_START} → ${PERIOD_END}`);
  console.log(`Balance:           ${newBalance}`);
  console.log(`Income rows:       ${newIncome.length}`);
  console.log(`Bill rows:         ${newBills.length}`);
  console.log(`Bills by category tag:`);
  const byTag = {};
  for (const b of newBills) {
    const t = b.tags?.[0] ?? '(none)';
    byTag[t] = (byTag[t] ?? 0) + 1;
  }
  for (const [t, n] of Object.entries(byTag).sort()) {
    console.log(`  ${t.padEnd(28)} ${n}`);
  }
  console.log(`Preserved other budgets: ${updatedBudgetMetas.length - 1}`);
  console.log('');

  if (!isWrite) {
    console.log('Dry run complete. Re-run with --confirm to write to prod.');
    return;
  }

  // Pre-write safety backup
  console.log('→ Capturing pre-write safety backup…');
  const backupPath = resolve(process.cwd(), `prod-backup-${ts}.json`);
  writeFileSync(backupPath, JSON.stringify(rawProd, null, 2));
  console.log(`✓ Pre-write safety backup → ${backupPath}`);

  // RPC write
  console.log('→ Writing via replace_budget_snapshot…');
  const { error } = await supabase.rpc('replace_budget_snapshot', {
    payload: { version: STORE_VERSION, data: snapshot },
  });
  if (error) {
    console.error('✗ RPC failed:', error);
    console.error('  Safety backup intact at:', backupPath);
    process.exit(1);
  }

  // Verify
  const [ic, bc, pc, budgetsAfter] = await Promise.all([
    supabase.from('income').select('id', { count: 'exact', head: true }),
    supabase.from('bills').select('id', { count: 'exact', head: true }),
    supabase.from('paid_state').select('key', { count: 'exact', head: true }),
    supabase.from('budgets').select('id,name'),
  ]);
  console.log(`✓ Wrote. Now: income=${ic.count}, bills=${bc.count}, paid=${pc.count}, budgets=${budgetsAfter.data?.length}`);
  console.log('  Budgets:', (budgetsAfter.data ?? []).map((b) => b.name).join(', '));
  console.log('');
  console.log('Refresh the deployed app to confirm.');
}

main().catch((e) => {
  console.error('✗ Unhandled error:', e);
  process.exit(1);
});
