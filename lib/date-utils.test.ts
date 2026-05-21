import { describe, expect, it } from 'vitest';
import { addDaysIso, daysBetween } from './date-utils';

describe('daysBetween', () => {
  it('returns 0 for equal dates', () => {
    expect(daysBetween('2026-04-09', '2026-04-09')).toBe(0);
  });

  it('returns positive when b is later', () => {
    expect(daysBetween('2026-04-09', '2026-05-09')).toBe(30);
    expect(daysBetween('2026-04-09', '2026-04-10')).toBe(1);
  });

  it('returns negative when b is earlier', () => {
    expect(daysBetween('2026-05-09', '2026-04-09')).toBe(-30);
  });

  it('handles month boundaries and year crossings', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-12-31')).toBe(365);
  });

  it('rounds across US DST transitions', () => {
    // US spring-forward 2026-03-08 → 23-hour day; rounding still yields 1.
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1);
    // US fall-back 2026-11-01 → 25-hour day; rounding still yields 1.
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
  });

  it('is consistent with addDaysIso roundtrip', () => {
    expect(daysBetween('2026-04-09', addDaysIso('2026-04-09', 42))).toBe(42);
    expect(daysBetween('2026-04-09', addDaysIso('2026-04-09', -17))).toBe(-17);
  });
});
