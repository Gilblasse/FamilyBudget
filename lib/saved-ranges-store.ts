import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from './format';
import type { DateRange } from './types';
import {
  addDaysIso,
  startOfWeekMondayIso,
  todayIso,
} from './date-utils';

export interface SavedRange {
  id: string;
  start: string;
  end: string;
  createdAt: number;
}

interface SavedRangesState {
  savedRanges: SavedRange[];
  addSavedRange: (range: DateRange) => void;
  removeSavedRange: (id: string) => void;
  clearSavedRanges: () => void;
}

const SAVED_RANGES_CAP = 6;

export function computeDefaultSeeds(today: string): SavedRange[] {
  const previousMonthEnd = addDaysIso(today, -1);
  const previousMonthStart = addDaysIso(today, -30);
  const previous14End = addDaysIso(today, -1);
  const previous14Start = addDaysIso(today, -14);
  const lastWeekMonday = addDaysIso(startOfWeekMondayIso(today), -7);
  const lastWeekSunday = addDaysIso(lastWeekMonday, 6);
  const thisWeekMonday = startOfWeekMondayIso(today);
  const now = Date.now();
  return [
    { id: uid(), start: previousMonthStart, end: previousMonthEnd, createdAt: now - 4 },
    { id: uid(), start: previous14Start, end: previous14End, createdAt: now - 3 },
    { id: uid(), start: lastWeekMonday, end: lastWeekSunday, createdAt: now - 2 },
    { id: uid(), start: thisWeekMonday, end: today, createdAt: now - 1 },
  ];
}

export const useSavedRanges = create<SavedRangesState>()(
  persist(
    (set) => ({
      savedRanges: computeDefaultSeeds(todayIso()),
      addSavedRange: (range) =>
        set((s) => {
          const deduped = s.savedRanges.filter(
            (x) => x.start !== range.start || x.end !== range.end,
          );
          const next: SavedRange = {
            id: uid(),
            start: range.start,
            end: range.end,
            createdAt: Date.now(),
          };
          return { savedRanges: [next, ...deduped].slice(0, SAVED_RANGES_CAP) };
        }),
      removeSavedRange: (id) =>
        set((s) => ({ savedRanges: s.savedRanges.filter((x) => x.id !== id) })),
      clearSavedRanges: () => set({ savedRanges: [] }),
    }),
    {
      name: 'dashboard.dateRange.savedRanges.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ savedRanges: s.savedRanges }),
    },
  ),
);
