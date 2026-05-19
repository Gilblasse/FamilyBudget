// One-off verification helper. Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// from the env (load .env.local first), checks the singleton row, and tries
// the replace_budget_snapshot RPC.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
  if (!m) continue;
  const v = m[2].replace(/^"(.*)"$/, '$1');
  if (!(m[1] in process.env)) process.env[m[1]] = v;
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const appMeta = await client.from('app_meta').select('*').eq('id', 1).maybeSingle();
console.log('app_meta:', appMeta.data, appMeta.error ?? 'OK');

const tables = ['budgets', 'periods', 'income', 'bills', 'paid_state', 'app_meta'];
for (const t of tables) {
  const { count, error } = await client.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t.padEnd(12)} rows=${count ?? '?'} ${error ? 'ERR ' + error.message : 'OK'}`);
}

// Probe the RPC. Empty payload should succeed (no budgets in payload => create
// synthetic 'budget-default', no-op against a freshly-applied schema).
const rpc = await client.rpc('replace_budget_snapshot', {
  payload: { version: 9, data: { balance: 0, income: [], bills: [], paid: {}, periods: [], activePeriodId: '', dateRange: null } },
});
console.log('replace_budget_snapshot:', rpc.data, rpc.error ?? 'OK');

// Roll back by replacing with a truly empty snapshot (no budgets) — only
// possible if we delete the synthetic budget-default we just inserted.
await client.from('budgets').delete().eq('id', 'budget-default');
await client.from('app_meta').update({ active_budget_id: '' }).eq('id', 1);
console.log('cleanup: ok');
