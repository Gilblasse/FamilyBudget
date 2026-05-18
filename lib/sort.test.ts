import { describe, it, expect } from 'vitest';
import { applySort, dirFor, nextDir, type SortState } from './sort';

type Col = 'name' | 'amount';

describe('nextDir', () => {
  it('starts a new cycle on a different column at asc', () => {
    expect(nextDir<Col>(null, 'name')).toEqual({ col: 'name', dir: 'asc' });
    expect(nextDir<Col>({ col: 'amount', dir: 'desc' }, 'name')).toEqual({
      col: 'name',
      dir: 'asc',
    });
  });

  it('cycles asc → desc → null on the same column', () => {
    const s1: SortState<Col> = nextDir<Col>(null, 'name');
    expect(s1).toEqual({ col: 'name', dir: 'asc' });
    const s2 = nextDir<Col>(s1, 'name');
    expect(s2).toEqual({ col: 'name', dir: 'desc' });
    const s3 = nextDir<Col>(s2, 'name');
    expect(s3).toBeNull();
  });
});

describe('dirFor', () => {
  it('returns the current dir when col matches', () => {
    expect(dirFor<Col>({ col: 'name', dir: 'desc' }, 'name')).toBe('desc');
  });

  it("returns 'none' for non-matching col or null state", () => {
    expect(dirFor<Col>({ col: 'amount', dir: 'asc' }, 'name')).toBe('none');
    expect(dirFor<Col>(null, 'name')).toBe('none');
  });
});

describe('applySort', () => {
  type Row = { name: string; amount: number };
  const rows: Row[] = [
    { name: 'Beta', amount: 50 },
    { name: 'alpha', amount: 200 },
    { name: 'Gamma', amount: 100 },
  ];

  const accessors: Record<Col, (r: Row) => string | number> = {
    name: (r) => r.name,
    amount: (r) => r.amount,
  };

  it('returns original array when state is null', () => {
    expect(applySort(rows, null, accessors)).toEqual(rows);
  });

  it('sorts strings with base sensitivity (case-insensitive)', () => {
    const out = applySort(rows, { col: 'name', dir: 'asc' }, accessors);
    expect(out.map((r) => r.name)).toEqual(['alpha', 'Beta', 'Gamma']);
  });

  it('sorts numbers numerically, not lexically', () => {
    const out = applySort(rows, { col: 'amount', dir: 'asc' }, accessors);
    expect(out.map((r) => r.amount)).toEqual([50, 100, 200]);
  });

  it('reverses for desc', () => {
    const out = applySort(rows, { col: 'amount', dir: 'desc' }, accessors);
    expect(out.map((r) => r.amount)).toEqual([200, 100, 50]);
  });

  it('does not mutate the input', () => {
    const original = [...rows];
    applySort(rows, { col: 'amount', dir: 'asc' }, accessors);
    expect(rows).toEqual(original);
  });
});
