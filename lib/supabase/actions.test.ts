import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  InvalidReferenceError,
  NotFoundError,
  clearPaid,
  deleteBill,
  patchMeta,
  setPaid,
  upsertBill,
  upsertIncome,
} from './actions';
import { StaleSchemaError } from './envelope';

/**
 * Minimal fake `SupabaseClient` with in-memory tables. Implements just enough
 * of the query-builder shape to exercise the action helpers without spinning
 * up a real Postgres connection.
 */
function makeFake(initial?: {
  active_budget_id?: string;
  store_version?: number;
  rows?: Partial<Record<string, Array<Record<string, unknown>>>>;
}) {
  const meta: {
    id: number;
    active_budget_id: string;
    store_version: number;
    updated_at: string;
  } = {
    id: 1,
    active_budget_id: initial?.active_budget_id ?? 'budget-default',
    store_version: initial?.store_version ?? 9,
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  const tables: Record<string, Array<Record<string, unknown>>> = {
    income: [],
    bills: [],
    periods: [],
    budgets: [{ id: 'budget-default', name: 'My Budget' }],
    paid_state: [],
    app_meta: [meta as unknown as Record<string, unknown>],
    ...(initial?.rows ?? {}),
  };

  function from(table: string) {
    const builder: {
      _filters: Array<{ col: string; val: unknown }>;
      _ops: Array<{ kind: 'update' | 'delete' | 'insert' | 'upsert' | 'select'; payload?: unknown }>;
      _selectCols: string;
      select(cols: string): typeof builder;
      eq(col: string, val: unknown): typeof builder;
      update(patch: Record<string, unknown>): typeof builder;
      delete(): typeof builder;
      insert(row: Record<string, unknown>): typeof builder;
      upsert(row: Record<string, unknown>, opts?: unknown): typeof builder;
      single(): Promise<{ data: unknown; error: unknown }>;
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      then(resolve: (v: { data: unknown; error: unknown }) => void): void;
    } = {
      _filters: [],
      _ops: [],
      _selectCols: '*',
      select(cols) {
        this._ops.push({ kind: 'select' });
        this._selectCols = cols;
        return this;
      },
      eq(col, val) {
        this._filters.push({ col, val });
        return this;
      },
      update(patch) {
        this._ops.push({ kind: 'update', payload: patch });
        return this;
      },
      delete() {
        this._ops.push({ kind: 'delete' });
        return this;
      },
      insert(row) {
        this._ops.push({ kind: 'insert', payload: row });
        return this;
      },
      upsert(row, opts) {
        void opts;
        this._ops.push({ kind: 'upsert', payload: row });
        return this;
      },
      async single() {
        const result = runOps(table, builder, tables);
        const row = (result.data as Array<Record<string, unknown>>)[0] ?? null;
        return { data: row, error: result.error };
      },
      async maybeSingle() {
        const result = runOps(table, builder, tables);
        const row = (result.data as Array<Record<string, unknown>>)[0] ?? null;
        return { data: row, error: result.error };
      },
      then(resolve) {
        resolve(runOps(table, builder, tables));
      },
    };
    return builder;
  }

  return {
    client: {
      from,
      async rpc() {
        return { data: null, error: null };
      },
    } as unknown as SupabaseClient,
    tables,
    meta,
  };
}

function runOps(
  table: string,
  builder: {
    _filters: Array<{ col: string; val: unknown }>;
    _ops: Array<{ kind: string; payload?: unknown }>;
  },
  tables: Record<string, Array<Record<string, unknown>>>,
): { data: unknown; error: unknown } {
  const rows = tables[table] ?? (tables[table] = []);
  const match = (r: Record<string, unknown>) =>
    builder._filters.every((f) => r[f.col] === f.val);

  const touched: Array<Record<string, unknown>> = [];
  for (const op of builder._ops) {
    if (op.kind === 'update') {
      for (const r of rows) {
        if (match(r)) {
          Object.assign(r, op.payload as Record<string, unknown>);
          touched.push(r);
        }
      }
    } else if (op.kind === 'delete') {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (match(rows[i])) {
          touched.push(rows[i]);
          rows.splice(i, 1);
        }
      }
    } else if (op.kind === 'insert') {
      const row = op.payload as Record<string, unknown>;
      rows.push(row);
      touched.push(row);
    } else if (op.kind === 'upsert') {
      const row = op.payload as Record<string, unknown>;
      // Simple upsert: replace by matching all non-payload identity cols.
      const idx = rows.findIndex((r) =>
        Object.keys(row)
          .filter((k) => k === 'id' || k === 'budget_id' || k === 'key')
          .every((k) => r[k] === row[k]),
      );
      if (idx >= 0) {
        Object.assign(rows[idx], row);
        touched.push(rows[idx]);
      } else {
        rows.push(row);
        touched.push(row);
      }
    } else if (op.kind === 'select' && builder._ops.length === 1) {
      // SELECT-only chain (no preceding update/delete): return filtered rows.
      return { data: rows.filter(match), error: null };
    }
  }
  return { data: touched, error: null };
}

describe('actions: version guard', () => {
  it('throws StaleSchemaError when clientVersion < stored', async () => {
    const { client } = makeFake({ store_version: 999 });
    await expect(upsertIncome('inc1', { source: 'x' }, 9, client)).rejects.toBeInstanceOf(
      StaleSchemaError,
    );
  });
});

describe('actions: income', () => {
  it('INSERTs a new income row on first upsert', async () => {
    const { client, tables } = makeFake({
      rows: {
        periods: [{ id: 'p1', budget_id: 'budget-default' }],
      },
    });
    await upsertIncome(
      'inc1',
      {
        id: 'inc1',
        periodId: 'p1',
        source: 'Paycheck',
        date: '2026-05-01',
        amount: 100,
        status: 'expected',
      },
      9,
      client,
    );
    expect(tables.income).toHaveLength(1);
    expect(tables.income[0]).toMatchObject({
      id: 'inc1',
      budget_id: 'budget-default',
      source: 'Paycheck',
      amount: 100,
    });
  });

  it('UPDATEs an existing income row on a partial PATCH payload', async () => {
    const { client, tables } = makeFake({
      rows: {
        income: [
          {
            id: 'inc1',
            budget_id: 'budget-default',
            source: 'Old',
            amount: 50,
          },
        ],
      },
    });
    await upsertIncome('inc1', { source: 'New' }, 9, client);
    expect(tables.income).toHaveLength(1);
    expect(tables.income[0].source).toBe('New');
    expect(tables.income[0].amount).toBe(50);
  });
});

describe('actions: bills', () => {
  it('DELETE 404s when the row does not exist', async () => {
    const { client } = makeFake();
    await expect(deleteBill('bill-missing', 9, client)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('DELETE removes the matching row', async () => {
    const { client, tables } = makeFake({
      rows: {
        bills: [
          { id: 'b1', budget_id: 'budget-default', name: 'Rent', amount: 100 },
        ],
      },
    });
    await deleteBill('b1', 9, client);
    expect(tables.bills).toHaveLength(0);
  });

  it('UPSERT updates name on a partial PATCH', async () => {
    const { client, tables } = makeFake({
      rows: {
        bills: [
          { id: 'b1', budget_id: 'budget-default', name: 'Old', amount: 100 },
        ],
      },
    });
    await upsertBill('b1', { name: 'New' }, 9, client);
    expect(tables.bills[0].name).toBe('New');
    expect(tables.bills[0].amount).toBe(100);
  });
});

describe('actions: period_id integrity', () => {
  // Bills / income reference periods by id, but the DB schema has no FK
  // (see supabase/migrations/0001_initial.sql). Without these runtime
  // checks, the API silently accepts orphan rows that later poison the
  // whole-snapshot PUT path. These tests pin the guard so it can't drift.

  it('upsertBill rejects when periodId points to a non-existent period', async () => {
    const { client, tables } = makeFake({
      rows: {
        periods: [{ id: 'p-other', budget_id: 'budget-default' }],
      },
    });
    await expect(
      upsertBill(
        'b1',
        {
          id: 'b1',
          periodId: 'p-missing',
          name: 'Rent',
          date: '2026-05-01',
          amount: 100,
          priority: 'crit',
          action: 'pay-full',
        },
        9,
        client,
      ),
    ).rejects.toBeInstanceOf(InvalidReferenceError);
    expect(tables.bills).toHaveLength(0);
  });

  it('upsertBill rejects when periodId is an empty string', async () => {
    const { client } = makeFake();
    await expect(
      upsertBill('b1', { id: 'b1', periodId: '', name: 'x' }, 9, client),
    ).rejects.toMatchObject({ name: 'InvalidReferenceError', field: 'periodId' });
  });

  it('upsertBill rejects when the period belongs to a different budget', async () => {
    const { client } = makeFake({
      rows: {
        periods: [{ id: 'p1', budget_id: 'budget-other' }],
      },
    });
    await expect(
      upsertBill('b1', { id: 'b1', periodId: 'p1', name: 'Rent' }, 9, client),
    ).rejects.toBeInstanceOf(InvalidReferenceError);
  });

  it('upsertIncome rejects when periodId is unknown', async () => {
    const { client } = makeFake();
    await expect(
      upsertIncome('inc1', { id: 'inc1', periodId: 'p-missing', source: 'x' }, 9, client),
    ).rejects.toBeInstanceOf(InvalidReferenceError);
  });

  it('partial PATCH without periodId skips the integrity check', async () => {
    // Editing an existing bill's name must not require the periodId to be
    // resolved — only mutations that touch periodId are validated.
    const { client, tables } = makeFake({
      rows: {
        bills: [
          { id: 'b1', budget_id: 'budget-default', name: 'Old', amount: 100 },
        ],
      },
    });
    await expect(upsertBill('b1', { name: 'Renamed' }, 9, client)).resolves.toMatchObject({
      ok: true,
      entity: 'bill',
    });
    expect(tables.bills[0].name).toBe('Renamed');
  });
});

describe('actions: paid', () => {
  it('setPaid upserts a paid_state row', async () => {
    const { client, tables } = makeFake();
    await setPaid('bill_b1', true, 9, client);
    expect(tables.paid_state).toEqual([
      { budget_id: 'budget-default', key: 'bill_b1', paid: true },
    ]);
  });

  it('clearPaid is idempotent on missing keys', async () => {
    const { client } = makeFake();
    await expect(clearPaid('bill_missing', 9, client)).resolves.toMatchObject({
      ok: true,
      entity: 'paid',
    });
  });

  it('clearPaid removes the matching row', async () => {
    const { client, tables } = makeFake({
      rows: {
        paid_state: [{ budget_id: 'budget-default', key: 'bill_b1', paid: true }],
      },
    });
    await clearPaid('bill_b1', 9, client);
    expect(tables.paid_state).toHaveLength(0);
  });
});

describe('actions: meta', () => {
  it('shallow-merges balance / activePeriodId / dateRange onto the active budget', async () => {
    const { client, tables } = makeFake();
    await patchMeta(
      { balance: 1234, activePeriodId: 'p1', dateRange: { start: '2026-05-01', end: '2026-05-31' } },
      9,
      client,
    );
    const b = tables.budgets.find((r) => r.id === 'budget-default')!;
    expect(b.balance).toBe(1234);
    expect(b.active_period_id).toBe('p1');
    expect(b.date_range_start).toBe('2026-05-01');
    expect(b.date_range_end).toBe('2026-05-31');
  });

  it('updates app_meta.active_budget_id when activeBudgetId is in the patch', async () => {
    const { client, meta } = makeFake();
    await patchMeta({ activeBudgetId: 'budget-second' }, 9, client);
    expect(meta.active_budget_id).toBe('budget-second');
  });
});

beforeEach(() => {
  // Each test constructs its own fake — nothing to globally reset.
});
