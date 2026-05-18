/**
 * Generic column-sort scaffolding. Previously duplicated verbatim in
 * `bills-table.tsx`, `income-table.tsx`, and `summary.tsx`. The `SortCol`
 * union differs per component (bills has `amount`, income has `source`,
 * summary doesn't sort by amount), so this module is generic over the
 * column-name string-literal union.
 */

export type SortDir = 'asc' | 'desc' | 'none';

export type SortState<TCol extends string> =
  | { col: TCol; dir: 'asc' | 'desc' }
  | null;

/**
 * 3-state cycle: clicking a column toggles asc → desc → null (cleared) →
 * asc on a different column starts a new cycle.
 */
export function nextDir<TCol extends string>(
  current: SortState<TCol>,
  col: TCol,
): SortState<TCol> {
  if (!current || current.col !== col) return { col, dir: 'asc' };
  if (current.dir === 'asc') return { col, dir: 'desc' };
  return null;
}

export function dirFor<TCol extends string>(
  state: SortState<TCol>,
  col: TCol,
): SortDir {
  if (state && state.col === col) return state.dir;
  return 'none';
}

/**
 * Pure sort with a per-column accessor. Strings compare with
 * locale-insensitive base sensitivity (e.g. `Á` ≈ `a`) which matches the
 * existing per-component behavior. Numbers compare numerically.
 */
export function applySort<T, TCol extends string>(
  rows: T[],
  state: SortState<TCol>,
  accessors: Record<TCol, (row: T) => string | number>,
): T[] {
  if (!state) return rows;
  const accessor = accessors[state.col];
  if (!accessor) return rows;
  const dir = state.dir === 'asc' ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
  });
  return copy;
}
