'use client';

import { useMemo } from 'react';
import { useBudget } from './store';
import type { DateRange } from './types';

export function useEffectiveDateRange(): DateRange | null {
  const periods = useBudget((s) => s.periods);
  const activeId = useBudget((s) => s.activePeriodId);
  const raw = useBudget((s) => s.dateRange);
  return useMemo(() => {
    if (raw) return raw;
    const period = periods.find((p) => p.id === activeId);
    return period ? { start: period.startDate, end: period.endDate } : null;
  }, [periods, activeId, raw]);
}
