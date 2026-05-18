import type { DateRange } from './types';

// Single-click range update used by the date-range picker. Each calendar
// click is authoritative: it always updates exactly one boundary (or
// collapses), so users never have to think about whether they're
// editing the "from" or the "to" leg of a range.
//
//   click < current.start  -> new start, end preserved
//   click > current.end    -> new end, start preserved
//   click within [start, end] (inclusive) -> collapse to a single-day range
//
// Reproduces the May 11→31 / click May 10 bug fix: May 10 < May 11, so the
// returned range is May 10 → May 31.
export function applyRangeClick(
  current: DateRange,
  clickedIso: string,
): DateRange {
  if (clickedIso < current.start) {
    return { start: clickedIso, end: current.end };
  }
  if (clickedIso > current.end) {
    return { start: current.start, end: clickedIso };
  }
  return { start: clickedIso, end: clickedIso };
}

// True when `iso` falls inside [range.start, range.end] inclusive.
// Convenience for `modifiers` in the calendar so the current range is
// still shaded while running in single-pick mode.
export function isInRange(iso: string, range: DateRange): boolean {
  return iso >= range.start && iso <= range.end;
}
