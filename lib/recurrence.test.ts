import { describe, it, expect } from 'vitest';
import { expandIncomeOccurrences, expandAllIncome, occurrenceKey } from './recurrence';
import type { Income, DateRange } from './types';

function income(partial: Partial<Income> & Pick<Income, 'date'>): Income {
  return {
    id: partial.id ?? 'i1',
    periodId: partial.periodId ?? 'p1',
    source: partial.source ?? 'src',
    date: partial.date,
    amount: partial.amount ?? 100,
    status: partial.status ?? 'expected',
    cadence: partial.cadence,
    secondDay: partial.secondDay,
    endDate: partial.endDate,
  };
}

const range = (start: string, end: string): DateRange => ({ start, end });

describe('expandIncomeOccurrences — once-only', () => {
  it('emits one occurrence when the date falls in range', () => {
    const r = income({ date: '2026-05-10', cadence: 'once' });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-05-10');
    expect(out[0].amount).toBe(100);
  });

  it('emits zero when the date precedes the range', () => {
    const r = income({ date: '2026-04-10', cadence: 'once' });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out).toHaveLength(0);
  });

  it('emits zero when the date follows the range', () => {
    const r = income({ date: '2026-06-10', cadence: 'once' });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out).toHaveLength(0);
  });

  it('treats missing cadence as once', () => {
    const r = income({ date: '2026-05-10' });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out).toHaveLength(1);
  });

  it('respects endDate cutoff before range.end', () => {
    const r = income({ date: '2026-05-10', cadence: 'once', endDate: '2026-05-09' });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out).toHaveLength(0);
  });
});

describe('expandIncomeOccurrences — weekly', () => {
  it('fast-forwards from anchor before range and emits in-range occurrences', () => {
    const r = income({ date: '2026-01-01', cadence: 'weekly' });
    const out = expandIncomeOccurrences(r, range('2026-02-01', '2026-02-21'));
    expect(out.map((o) => o.date)).toEqual(['2026-02-05', '2026-02-12', '2026-02-19']);
  });

  it('stops at endDate cutoff', () => {
    const r = income({
      date: '2026-05-01',
      cadence: 'weekly',
      endDate: '2026-05-15',
    });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out.map((o) => o.date)).toEqual(['2026-05-01', '2026-05-08', '2026-05-15']);
  });
});

describe('expandIncomeOccurrences — biweekly', () => {
  it('emits every 14 days inside the range', () => {
    const r = income({ date: '2026-05-01', cadence: 'biweekly' });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-06-30'));
    expect(out.map((o) => o.date)).toEqual([
      '2026-05-01',
      '2026-05-15',
      '2026-05-29',
      '2026-06-12',
      '2026-06-26',
    ]);
  });

  it('respects endDate cutoff in middle of range', () => {
    const r = income({
      date: '2026-05-01',
      cadence: 'biweekly',
      endDate: '2026-05-20',
    });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-06-30'));
    expect(out.map((o) => o.date)).toEqual(['2026-05-01', '2026-05-15']);
  });
});

describe('expandIncomeOccurrences — monthly', () => {
  it('clamps day 31 to last day of short months', () => {
    const r = income({ date: '2026-01-31', cadence: 'monthly' });
    const out = expandIncomeOccurrences(r, range('2026-01-31', '2026-04-30'));
    expect(out.map((o) => o.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('emits exactly one occurrence when range covers a single month', () => {
    const r = income({ date: '2026-05-15', cadence: 'monthly' });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out.map((o) => o.date)).toEqual(['2026-05-15']);
  });
});

describe('expandIncomeOccurrences — semimonthly', () => {
  it('emits both anchorDay and secondDay each month', () => {
    const r = income({
      date: '2026-05-15',
      cadence: 'semimonthly',
      secondDay: 28,
    });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-06-30'));
    expect(out.map((o) => o.date)).toEqual([
      '2026-05-15',
      '2026-05-28',
      '2026-06-15',
      '2026-06-28',
    ]);
  });

  it('dedupes when anchorDay equals secondDay', () => {
    const r = income({
      date: '2026-05-15',
      cadence: 'semimonthly',
      secondDay: 15,
    });
    const out = expandIncomeOccurrences(r, range('2026-05-01', '2026-05-31'));
    expect(out).toHaveLength(1);
  });
});

describe('expandAllIncome', () => {
  it('emits one anchor-date occurrence per template when range is null (everything-passes parity)', () => {
    const out = expandAllIncome(
      [income({ id: 'a', date: '2026-05-10', cadence: 'once' })],
      null,
    );
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-05-10');
  });

  it('returns empty for empty input', () => {
    expect(expandAllIncome([], range('2026-05-01', '2026-05-31'))).toEqual([]);
  });

  it('sorts occurrences chronologically across sources', () => {
    const a = income({ id: 'a', date: '2026-05-20', cadence: 'once' });
    const b = income({ id: 'b', date: '2026-05-10', cadence: 'once' });
    const out = expandAllIncome([a, b], range('2026-05-01', '2026-05-31'));
    expect(out.map((o) => o.date)).toEqual(['2026-05-10', '2026-05-20']);
  });

  it('includes records across multiple periodIds when their occurrences fall in range', () => {
    const periodA = income({
      id: 'a',
      periodId: 'p-A',
      date: '2026-04-28',
      cadence: 'once',
    });
    const periodB = income({
      id: 'b',
      periodId: 'p-B',
      date: '2026-06-01',
      cadence: 'once',
    });
    const out = expandAllIncome([periodA, periodB], range('2026-04-20', '2026-06-10'));
    expect(out.map((o) => o.periodId)).toEqual(['p-A', 'p-B']);
  });
});

describe('occurrenceKey', () => {
  it('uses inc_<id> for once-only', () => {
    const r = income({ id: 'x', date: '2026-05-10', cadence: 'once' });
    expect(occurrenceKey(r, '2026-05-10')).toBe('inc_x');
  });

  it('uses inc_<id>_<date> for recurring', () => {
    const r = income({ id: 'x', date: '2026-05-10', cadence: 'biweekly' });
    expect(occurrenceKey(r, '2026-05-24')).toBe('inc_x_2026-05-24');
  });
});
