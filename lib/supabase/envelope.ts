/**
 * Whole-snapshot read/replace against Supabase Postgres. Used by:
 *   - GET  /api/budget                  -> loadEnvelope()
 *   - PUT  /api/budget                  -> saveEnvelope()
 *   - per-entity GET endpoints (income, bills, periods, budgets, meta) which
 *     read via fetchEnvelopeData() in lib/api/route-helpers.ts
 *
 * The wire shape stays byte-identical to the legacy Apps Script envelope so
 * the rest of the app doesn't notice the backend swap.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { STORE_VERSION } from '@/lib/store';
import type {
  Adjustment,
  Bill,
  BudgetData,
  BudgetMeta,
  BudgetPeriod,
  BudgetSnapshot,
  DateRange,
  Income,
  IncomeCadence,
  IncomeStatus,
  PaidState,
  Priority,
  BillAction,
} from '@/lib/types';
import { getSupabase } from './server';

export interface RemoteEnvelope {
  version: number;
  data: BudgetSnapshot | null;
  updatedAt: string;
}

export class StaleSchemaError extends Error {
  readonly storedVersion: number;
  readonly incomingVersion: number;
  constructor(stored: number, incoming: number) {
    super(`stale schema: stored=${stored}, incoming=${incoming}`);
    this.name = 'StaleSchemaError';
    this.storedVersion = stored;
    this.incomingVersion = incoming;
  }
}

interface BudgetRow {
  id: string;
  name: string;
  created_at: string;
  default_range_start: string;
  default_range_end: string;
  balance: number | string;
  active_period_id: string;
  date_range_start: string | null;
  date_range_end: string | null;
}

interface PeriodRow {
  id: string;
  budget_id: string;
  start_date: string;
  end_date: string;
  label: string | null;
}

interface IncomeRow {
  id: string;
  budget_id: string;
  period_id: string;
  source: string;
  date: string;
  amount: number | string;
  status: IncomeStatus;
  cadence: IncomeCadence | null;
  second_day: number | null;
  end_date: string | null;
  adjustments: Adjustment[] | null;
}

interface BillRow {
  id: string;
  budget_id: string;
  period_id: string;
  name: string;
  date: string;
  amount: number | string;
  priority: Priority;
  action: BillAction;
  tags: string[] | null;
  adjustments: Adjustment[] | null;
}

interface PaidRow {
  budget_id: string;
  key: string;
  paid: boolean;
}

interface AppMetaRow {
  active_budget_id: string;
  store_version: number;
  updated_at: string;
}

/**
 * Postgres returns numeric() columns as strings in the JS driver. Coerce
 * everything that should be a number consistently.
 */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function rangeFromColumns(start: string | null, end: string | null): DateRange | null {
  if (!start || !end) return null;
  return { start, end };
}

function emptyBudgetData(): BudgetData {
  return {
    balance: 0,
    income: [],
    bills: [],
    paid: {},
    periods: [],
    activePeriodId: '',
    dateRange: null,
  };
}

function periodFromRow(row: PeriodRow): BudgetPeriod {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    ...(row.label != null ? { label: row.label } : {}),
  };
}

function incomeFromRow(row: IncomeRow): Income {
  return {
    id: row.id,
    periodId: row.period_id,
    source: row.source,
    date: row.date,
    amount: num(row.amount),
    status: row.status,
    ...(row.cadence ? { cadence: row.cadence } : {}),
    ...(row.second_day != null ? { secondDay: row.second_day } : {}),
    ...(row.end_date ? { endDate: row.end_date } : {}),
    ...(Array.isArray(row.adjustments) && row.adjustments.length > 0
      ? { adjustments: row.adjustments }
      : {}),
  };
}

function billFromRow(row: BillRow): Bill {
  return {
    id: row.id,
    periodId: row.period_id,
    name: row.name,
    date: row.date,
    amount: num(row.amount),
    priority: row.priority,
    action: row.action,
    ...(row.tags ? { tags: row.tags } : {}),
    ...(Array.isArray(row.adjustments) && row.adjustments.length > 0
      ? { adjustments: row.adjustments }
      : {}),
  };
}

function budgetMetaFromRow(row: BudgetRow): BudgetMeta {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    defaultRange: { start: row.default_range_start, end: row.default_range_end },
  };
}

function groupBy<T extends { budget_id: string }>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const list = out.get(row.budget_id);
    if (list) list.push(row);
    else out.set(row.budget_id, [row]);
  }
  return out;
}

export async function loadEnvelope(
  client: SupabaseClient = getSupabase(),
): Promise<RemoteEnvelope> {
  const [metaRes, budgetsRes, periodsRes, incomeRes, billsRes, paidRes] = await Promise.all([
    client.from('app_meta').select('active_budget_id, store_version, updated_at').eq('id', 1).maybeSingle(),
    client.from('budgets').select('*'),
    client.from('periods').select('*'),
    client.from('income').select('*'),
    client.from('bills').select('*'),
    client.from('paid_state').select('*'),
  ]);

  for (const r of [metaRes, budgetsRes, periodsRes, incomeRes, billsRes, paidRes]) {
    if (r.error) throw r.error;
  }

  const meta = metaRes.data as AppMetaRow | null;
  const budgets = (budgetsRes.data as BudgetRow[] | null) ?? [];

  if (budgets.length === 0) {
    return {
      version: meta?.store_version ?? STORE_VERSION,
      data: null,
      updatedAt: meta?.updated_at ?? new Date(0).toISOString(),
    };
  }

  const periodsByBudget = groupBy((periodsRes.data as PeriodRow[] | null) ?? []);
  const incomeByBudget = groupBy((incomeRes.data as IncomeRow[] | null) ?? []);
  const billsByBudget = groupBy((billsRes.data as BillRow[] | null) ?? []);
  const paidByBudget = groupBy((paidRes.data as PaidRow[] | null) ?? []);

  const budgetData: Record<string, BudgetData> = {};
  const metas: BudgetMeta[] = [];

  for (const b of budgets) {
    metas.push(budgetMetaFromRow(b));

    const paid: PaidState = {};
    for (const p of paidByBudget.get(b.id) ?? []) {
      if (p.paid) paid[p.key] = true;
    }

    budgetData[b.id] = {
      balance: num(b.balance),
      income: (incomeByBudget.get(b.id) ?? []).map(incomeFromRow),
      bills: (billsByBudget.get(b.id) ?? []).map(billFromRow),
      paid,
      periods: (periodsByBudget.get(b.id) ?? []).map(periodFromRow),
      activePeriodId: b.active_period_id,
      dateRange: rangeFromColumns(b.date_range_start, b.date_range_end),
    };
  }

  const activeId = meta?.active_budget_id || budgets[0].id;
  const activeSlice = budgetData[activeId] ?? emptyBudgetData();

  const snapshot: BudgetSnapshot = {
    ...activeSlice,
    budgets: metas,
    activeBudgetId: activeId,
    budgetData,
  };

  return {
    version: meta?.store_version ?? STORE_VERSION,
    data: snapshot,
    updatedAt: meta?.updated_at ?? new Date().toISOString(),
  };
}

interface SaveEnvelopeInput {
  version?: number;
  data: BudgetSnapshot;
}

/**
 * Atomic whole-snapshot replace via the replace_budget_snapshot RPC. The
 * function locks app_meta, enforces the stale-schema guard, and rewrites all
 * budget/income/bill/period/paid rows in a single transaction.
 */
export async function saveEnvelope(
  input: SaveEnvelopeInput,
  client: SupabaseClient = getSupabase(),
): Promise<{ version: number; updatedAt: string }> {
  const payload = {
    version: input.version ?? STORE_VERSION,
    data: input.data,
  };

  const { data, error } = await client.rpc('replace_budget_snapshot', { payload });

  if (error) {
    // P0001 = raise exception with our stale-schema message.
    if (error.code === 'P0001' && /stale schema/i.test(error.message)) {
      const match = /stored=(\d+).*incoming=(\d+)/.exec(error.message);
      const stored = match ? Number(match[1]) : -1;
      const incoming = match ? Number(match[2]) : payload.version;
      throw new StaleSchemaError(stored, incoming);
    }
    throw error;
  }

  // RPC returns `setof record` => an array of rows. Take the first.
  const rows = (data ?? []) as Array<{ version: number; updated_at: string }>;
  const first = rows[0];
  return {
    version: first?.version ?? payload.version,
    updatedAt: first?.updated_at ?? new Date().toISOString(),
  };
}
