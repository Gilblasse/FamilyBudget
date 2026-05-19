import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadEnvelope, saveEnvelope, StaleSchemaError } from './envelope';

interface CannedTable {
  rows: Array<Record<string, unknown>>;
  single?: Record<string, unknown> | null;
}

interface FakeOpts {
  app_meta?: { active_budget_id: string; store_version: number; updated_at: string } | null;
  budgets?: Array<Record<string, unknown>>;
  periods?: Array<Record<string, unknown>>;
  income?: Array<Record<string, unknown>>;
  bills?: Array<Record<string, unknown>>;
  paid_state?: Array<Record<string, unknown>>;
  rpc?: (name: string, args: unknown) => { data: unknown; error: unknown };
}

function makeFake(opts: FakeOpts = {}): SupabaseClient {
  const tables: Record<string, CannedTable> = {
    app_meta: { rows: [], single: opts.app_meta ?? null },
    budgets: { rows: opts.budgets ?? [] },
    periods: { rows: opts.periods ?? [] },
    income: { rows: opts.income ?? [] },
    bills: { rows: opts.bills ?? [] },
    paid_state: { rows: opts.paid_state ?? [] },
  };

  function from(table: string) {
    const t = tables[table] ?? { rows: [] };
    const builder = {
      _cols: '*',
      select(cols: string) {
        builder._cols = cols;
        return builder;
      },
      eq() {
        return builder;
      },
      async maybeSingle() {
        return { data: t.single ?? null, error: null };
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        // PromiseLike for `await client.from('x').select('*')`.
        resolve({ data: t.rows, error: null });
      },
    };
    return builder;
  }

  return {
    from,
    rpc:
      opts.rpc ??
      (() => ({
        data: [{ version: 9, updated_at: '2026-05-18T00:00:00.000Z' }],
        error: null,
      })),
  } as unknown as SupabaseClient;
}

describe('loadEnvelope', () => {
  it('returns data: null when there are no budgets so the bridge keeps local state', async () => {
    const fake = makeFake({
      app_meta: {
        active_budget_id: '',
        store_version: 9,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    });
    const env = await loadEnvelope(fake);
    expect(env.version).toBe(9);
    expect(env.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(env.data).toBeNull();
  });

  it('assembles a snapshot with the active budget mirrored at the top level', async () => {
    const fake = makeFake({
      app_meta: {
        active_budget_id: 'budget-default',
        store_version: 9,
        updated_at: '2026-05-01T00:00:00.000Z',
      },
      budgets: [
        {
          id: 'budget-default',
          name: 'My Budget',
          created_at: '2026-01-01T00:00:00.000Z',
          default_range_start: '2026-04-09',
          default_range_end: '2026-05-14',
          balance: '1234.56',
          active_period_id: 'p1',
          date_range_start: '2026-04-09',
          date_range_end: '2026-05-14',
        },
        {
          id: 'budget-second',
          name: 'Vacation',
          created_at: '2026-02-01T00:00:00.000Z',
          default_range_start: '2026-06-01',
          default_range_end: '2026-06-30',
          balance: 0,
          active_period_id: 'p2',
          date_range_start: null,
          date_range_end: null,
        },
      ],
      periods: [
        {
          id: 'p1',
          budget_id: 'budget-default',
          start_date: '2026-04-09',
          end_date: '2026-05-14',
          label: null,
        },
      ],
      income: [
        {
          id: 'inc1',
          budget_id: 'budget-default',
          period_id: 'p1',
          source: 'Paycheck',
          date: '2026-04-15',
          amount: '4191.76',
          status: 'expected',
          cadence: null,
          second_day: null,
          end_date: null,
        },
      ],
      bills: [
        {
          id: 'b1',
          budget_id: 'budget-default',
          period_id: 'p1',
          name: 'Rent',
          date: '2026-05-01',
          amount: '2970.95',
          priority: 'crit',
          action: 'pay-full',
          tags: null,
        },
      ],
      paid_state: [
        { budget_id: 'budget-default', key: 'bill_b1', paid: true },
      ],
    });

    const env = await loadEnvelope(fake);
    if (!env.data) throw new Error('expected non-null envelope data');
    const data = env.data;
    expect(data.activeBudgetId).toBe('budget-default');
    expect(data.balance).toBe(1234.56);
    expect(data.activePeriodId).toBe('p1');
    expect(data.dateRange).toEqual({ start: '2026-04-09', end: '2026-05-14' });
    expect(data.income).toEqual([
      {
        id: 'inc1',
        periodId: 'p1',
        source: 'Paycheck',
        date: '2026-04-15',
        amount: 4191.76,
        status: 'expected',
      },
    ]);
    expect(data.bills).toEqual([
      {
        id: 'b1',
        periodId: 'p1',
        name: 'Rent',
        date: '2026-05-01',
        amount: 2970.95,
        priority: 'crit',
        action: 'pay-full',
      },
    ]);
    expect(data.paid).toEqual({ bill_b1: true });
    expect(data.budgets).toHaveLength(2);
    expect(data.budgetData?.['budget-default'].balance).toBe(1234.56);
    expect(data.budgetData?.['budget-second'].balance).toBe(0);
    expect(data.budgetData?.['budget-second'].activePeriodId).toBe('p2');
  });
});

describe('saveEnvelope', () => {
  const SNAPSHOT = {
    balance: 0,
    income: [],
    bills: [],
    paid: {},
    periods: [],
    activePeriodId: '',
    dateRange: null,
    budgets: [],
    activeBudgetId: '',
    budgetData: {},
  };

  it('forwards to the replace_budget_snapshot RPC and returns version + updatedAt', async () => {
    let called: { name?: string; args?: unknown } = {};
    const fake = makeFake({
      rpc: (name, args) => {
        called = { name, args };
        return {
          data: [{ version: 9, updated_at: '2026-05-18T00:00:00.000Z' }],
          error: null,
        };
      },
    });
    const out = await saveEnvelope({ version: 9, data: SNAPSHOT }, fake);
    expect(called.name).toBe('replace_budget_snapshot');
    expect(called.args).toEqual({ payload: { version: 9, data: SNAPSHOT } });
    expect(out).toEqual({ version: 9, updatedAt: '2026-05-18T00:00:00.000Z' });
  });

  it('throws StaleSchemaError on a P0001 stale schema error', async () => {
    const fake = makeFake({
      rpc: () => ({
        data: null,
        error: {
          code: 'P0001',
          message: 'stale schema: stored=999, incoming=9',
        },
      }),
    });
    await expect(saveEnvelope({ version: 9, data: SNAPSHOT }, fake)).rejects.toBeInstanceOf(
      StaleSchemaError,
    );
  });
});
