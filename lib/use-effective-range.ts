'use client';

import { useMemo } from 'react';
import { useBudget } from './store';
import { clampRangeToPeriod } from './filters';
import type { DateRange } from './types';

export function useEffectiveDateRange(): DateRange | null {
  const periods = useBudget((s) => s.periods);
  const activeId = useBudget((s) => s.activePeriodId);
  const raw = useBudget((s) => s.dateRange);
  return useMemo(() => {
    const period = periods.find((p) => p.id === activeId);
    return clampRangeToPeriod(raw, period);
  }, [periods, activeId, raw]);
}
