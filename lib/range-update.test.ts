import { describe, it, expect } from 'vitest';
import { applyRangeClick, isInRange } from './range-update';

describe('applyRangeClick', () => {
  const current = { start: '2026-05-11', end: '2026-05-31' };

  it('extends start backward when clicking before current start (the May 11/May 10 bug)', () => {
    expect(applyRangeClick(current, '2026-05-10')).toEqual({
      start: '2026-05-10',
      end: '2026-05-31',
    });
  });

  it('extends end forward when clicking after current end', () => {
    expect(applyRangeClick(current, '2026-06-05')).toEqual({
      start: '2026-05-11',
      end: '2026-06-05',
    });
  });

  it('collapses to a single-day range when clicking inside the range', () => {
    expect(applyRangeClick(current, '2026-05-20')).toEqual({
      start: '2026-05-20',
      end: '2026-05-20',
    });
  });

  it('collapses to a single-day range when clicking exactly on the start', () => {
    expect(applyRangeClick(current, '2026-05-11')).toEqual({
      start: '2026-05-11',
      end: '2026-05-11',
    });
  });

  it('collapses to a single-day range when clicking exactly on the end', () => {
    expect(applyRangeClick(current, '2026-05-31')).toEqual({
      start: '2026-05-31',
      end: '2026-05-31',
    });
  });

  it('handles a one-day range with a click before it', () => {
    const oneDay = { start: '2026-05-15', end: '2026-05-15' };
    expect(applyRangeClick(oneDay, '2026-05-10')).toEqual({
      start: '2026-05-10',
      end: '2026-05-15',
    });
  });

  it('handles a one-day range with a click after it', () => {
    const oneDay = { start: '2026-05-15', end: '2026-05-15' };
    expect(applyRangeClick(oneDay, '2026-05-20')).toEqual({
      start: '2026-05-15',
      end: '2026-05-20',
    });
  });

  it('never produces an inverted range (start > end)', () => {
    const cases = [
      { current, click: '2026-05-01' },
      { current, click: '2026-05-15' },
      { current, click: '2026-06-30' },
      { current, click: '2026-05-11' },
      { current, click: '2026-05-31' },
    ];
    for (const { current: c, click } of cases) {
      const next = applyRangeClick(c, click);
      expect(next.start <= next.end).toBe(true);
    }
  });
});

describe('isInRange', () => {
  const r = { start: '2026-05-11', end: '2026-05-31' };
  it('is inclusive of both bounds', () => {
    expect(isInRange('2026-05-11', r)).toBe(true);
    expect(isInRange('2026-05-31', r)).toBe(true);
  });
  it('is true for any day strictly between bounds', () => {
    expect(isInRange('2026-05-15', r)).toBe(true);
  });
  it('is false outside the range', () => {
    expect(isInRange('2026-05-10', r)).toBe(false);
    expect(isInRange('2026-06-01', r)).toBe(false);
  });
});
