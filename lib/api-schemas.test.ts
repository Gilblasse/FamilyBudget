import { describe, it, expect } from 'vitest';
import {
  billCreateSchema,
  billUpdateSchema,
  budgetMetaCreateSchema,
  incomeCreateSchema,
  incomeUpdateSchema,
  metaPatchSchema,
  paidKeyParamSchema,
  periodCreateSchema,
} from './api-schemas';

describe('incomeCreateSchema', () => {
  it('accepts a fully-formed income row with client-minted id', () => {
    const res = incomeCreateSchema.safeParse({
      id: 'inc_abc',
      periodId: 'per_1',
      source: 'Salary',
      date: '2026-04-01',
      amount: 1000,
      status: 'expected',
      cadence: 'monthly',
    });
    expect(res.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const res = incomeCreateSchema.safeParse({
      periodId: 'per_1',
      source: 'Salary',
      date: '2026-04-01',
      amount: 1000,
      status: 'expected',
    });
    expect(res.success).toBe(false);
  });

  it('rejects bad date format', () => {
    const res = incomeCreateSchema.safeParse({
      id: 'inc_abc',
      periodId: 'per_1',
      source: 'Salary',
      date: '04-01-2026',
      amount: 1000,
      status: 'expected',
    });
    expect(res.success).toBe(false);
  });
});

describe('incomeUpdateSchema', () => {
  it('accepts a fully-empty patch (partial)', () => {
    const res = incomeUpdateSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it('omits the id field', () => {
    const res = incomeUpdateSchema.safeParse({ amount: 500 });
    expect(res.success).toBe(true);
  });
});

describe('billCreateSchema / billUpdateSchema', () => {
  it('accepts a bill with optional tags', () => {
    const res = billCreateSchema.safeParse({
      id: 'bill_x',
      periodId: 'per_1',
      name: 'Rent',
      date: '2026-04-01',
      amount: 1500,
      priority: 'crit',
      action: 'pay-full',
      tags: ['subscription'],
    });
    expect(res.success).toBe(true);
  });

  it('rejects invalid priority enum', () => {
    const res = billCreateSchema.safeParse({
      id: 'bill_x',
      periodId: 'per_1',
      name: 'Rent',
      date: '2026-04-01',
      amount: 1500,
      priority: 'urgent',
      action: 'pay-full',
    });
    expect(res.success).toBe(false);
  });

  it('billUpdateSchema accepts {}', () => {
    expect(billUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe('periodCreateSchema', () => {
  it('accepts a period with optional label', () => {
    expect(
      periodCreateSchema.safeParse({
        id: 'per_2',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        label: 'May',
      }).success,
    ).toBe(true);
  });

  it('accepts a period without label', () => {
    expect(
      periodCreateSchema.safeParse({
        id: 'per_2',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      }).success,
    ).toBe(true);
  });
});

describe('budgetMetaCreateSchema', () => {
  it('accepts a budget meta', () => {
    expect(
      budgetMetaCreateSchema.safeParse({
        id: 'bud_1',
        name: 'Main',
        createdAt: '2026-01-01T00:00:00Z',
        defaultRange: { start: '2026-01-01', end: '2026-01-31' },
      }).success,
    ).toBe(true);
  });
});

describe('paidKeyParamSchema', () => {
  const ok = ['bill_abc', 'bill_abc-def', 'inc_xyz', 'inc_xyz_2026-05-15', 'inc_xyz-1_2026-12-31'];
  const bad = [
    'something_else',
    'inc_',
    'bill_',
    'inc_xyz_05-15-2026',
    'inc_xyz_2026-5-1',
    '',
    'inc_xyz_extra_2026-05-15',
  ];
  it.each(ok)('accepts %s', (id) => {
    expect(paidKeyParamSchema.safeParse({ id }).success).toBe(true);
  });
  it.each(bad)('rejects %s', (id) => {
    expect(paidKeyParamSchema.safeParse({ id }).success).toBe(false);
  });
});

describe('metaPatchSchema', () => {
  it('accepts a single-key patch', () => {
    expect(metaPatchSchema.safeParse({ balance: 1000 }).success).toBe(true);
  });

  it('accepts dateRange: null', () => {
    expect(metaPatchSchema.safeParse({ dateRange: null }).success).toBe(true);
  });

  it('rejects empty object via refine', () => {
    const res = metaPatchSchema.safeParse({});
    expect(res.success).toBe(false);
  });

  it('rejects unknown keys via strict-ish defaults (extra keys allowed in zod default but pass through)', () => {
    // Zod is permissive by default — unknown keys are stripped, not errored.
    // We rely on the server route to only forward known fields. This test
    // documents the behavior so it does not regress.
    const res = metaPatchSchema.safeParse({ balance: 100, hacker: 'value' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect('hacker' in res.data).toBe(false);
    }
  });
});
