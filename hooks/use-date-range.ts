'use client';

import { useCallback, useMemo } from 'react';
import { useBudget } from '@/lib/store';
import { useSavedRanges, type SavedRange } from '@/lib/saved-ranges-store';
import { useEffectiveDateRange } from '@/lib/use-effective-range';
import type { BudgetPeriod, DateRange } from '@/lib/types';

export interface UseDateRangeResult {
  range: DateRange | null;
  effective: DateRange | null;
  activePeriod: BudgetPeriod | undefined;
  setRange: (range: DateRange | null) => void;
  resetRange: () => void;
  savedRanges: SavedRange[];
  addSavedRange: (range: DateRange) => void;
  removeSavedRange: (id: string) => void;
}

export function useDateRange(): UseDateRangeResult {
  const range = useBudget((s) => s.dateRange);
  const periods = useBudget((s) => s.periods);
  const activeId = useBudget((s) => s.activePeriodId);
  const setDateRange = useBudget((s) => s.setDateRange);
  const resetDateRange = useBudget((s) => s.resetDateRange);
  const effective = useEffectiveDateRange();
  const savedRanges = useSavedRanges((s) => s.savedRanges);
  const addSavedRange = useSavedRanges((s) => s.addSavedRange);
  const removeSavedRange = useSavedRanges((s) => s.removeSavedRange);

  const activePeriod = useMemo(
    () => periods.find((p) => p.id === activeId),
    [periods, activeId],
  );

  const setRange = useCallback(
    (next: DateRange | null) => {
      if (next === null) {
        resetDateRange();
        return;
      }
      setDateRange(next);
    },
    [resetDateRange, setDateRange],
  );

  const resetRange = useCallback(() => resetDateRange(), [resetDateRange]);

  return {
    range,
    effective,
    activePeriod,
    setRange,
    resetRange,
    savedRanges,
    addSavedRange,
    removeSavedRange,
  };
}
