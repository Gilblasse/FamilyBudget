import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// `localStorage` is undefined in vitest's `node` environment. The store
// module references it through `createJSONStorage(() => localStorage)`,
// which is lazy, but the persist middleware still pokes it on first set.
// A minimal shim lets the module load cleanly under Node.
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = String(v);
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k of Object.keys(store)) delete store[k];
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length() {
          return Object.keys(store).length;
        },
      },
    });
  }
});

// Tests share a single Zustand store instance. Reset to a known clean
// state before each test so cross-test contamination can't mask bugs.
async function resetStoreForTest() {
  const { useBudget } = await import('./store');
  const fresh = {
    balance: 0,
    income: [] as never[],
    bills: [] as never[],
    paid: {},
    periods: [
      { id: 'seed-period-1', startDate: '2026-04-09', endDate: '2026-05-14' },
    ],
    activePeriodId: 'seed-period-1',
    dateRange: null,
    budgets: [
      {
        id: 'budget-default',
        name: 'My Budget',
        createdAt: '2026-01-01T00:00:00.000Z',
        defaultRange: { start: '2026-04-09', end: '2026-05-14' },
      },
    ],
    activeBudgetId: 'budget-default',
    budgetData: {},
  };
  // Partial setState (no `replace` flag) keeps the action methods bound
  // and only overwrites the data fields.
  useBudget.setState(fresh);
}

beforeEach(async () => {
  await resetStoreForTest();
});

describe('exportJson / importData round-trip', () => {
  it('exports the full multi-budget envelope and re-imports losslessly', async () => {
    const { useBudget, STORE_VERSION } = await import('./store');

    const secondId = useBudget.getState().addBudget('Second budget', {
      start: '2026-07-01',
      end: '2026-07-31',
    });
    const firstId = useBudget.getState().budgets.find((b) => b.id !== secondId)!.id;
    useBudget.getState().setActiveBudget(firstId);

    const json = useBudget.getState().exportJson();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(STORE_VERSION);
    expect(parsed.budgets).toHaveLength(2);
    expect(parsed.activeBudgetId).toBe(firstId);
    expect(parsed.budgetData[secondId]).toBeDefined();

    // Wipe to a single-budget baseline, then import.
    await resetStoreForTest();
    expect(useBudget.getState().budgets).toHaveLength(1);

    useBudget.getState().importData(parsed);
    const after = useBudget.getState();
    expect(after.budgets).toHaveLength(2);
    expect(after.budgets.some((b) => b.id === secondId)).toBe(true);
    expect(after.activeBudgetId).toBe(firstId);
    expect(after.budgetData[secondId]).toBeDefined();
  });

  it('legacy single-budget JSON imports the active slice and preserves other budgets', async () => {
    const { useBudget } = await import('./store');

    const otherId = useBudget.getState().addBudget('Other budget');
    const myBudgetId = useBudget.getState().budgets.find((b) => b.id !== otherId)!.id;
    useBudget.getState().setActiveBudget(myBudgetId);
    const budgetsBefore = useBudget.getState().budgets.length;
    expect(budgetsBefore).toBe(2);

    // A legacy export omits multi-budget keys entirely.
    const legacy = {
      balance: 4242,
      income: [],
      bills: [],
      paid: {},
      periods: useBudget.getState().periods,
      activePeriodId: useBudget.getState().activePeriodId,
      dateRange: null,
    };

    useBudget.getState().importData(legacy);
    const after = useBudget.getState();

    // Active slice updated to the imported balance.
    expect(after.balance).toBe(4242);
    // Multi-budget state preserved — the second budget is untouched.
    expect(after.budgets.some((b) => b.id === otherId)).toBe(true);
    expect(after.budgets).toHaveLength(budgetsBefore);
  });

  it('exportJson stamps the current STORE_VERSION', async () => {
    const { useBudget, STORE_VERSION } = await import('./store');
    const parsed = JSON.parse(useBudget.getState().exportJson());
    expect(parsed.version).toBe(STORE_VERSION);
  });
});
