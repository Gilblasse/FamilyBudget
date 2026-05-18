import { describe, it, expect } from 'vitest';
import { inRange } from './filters';

describe('inRange', () => {
  it('returns true when range is null', () => {
    expect(inRange('2026-05-10', null)).toBe(true);
  });

  it('returns true on the lower boundary', () => {
    expect(inRange('2026-05-01', { start: '2026-05-01', end: '2026-05-31' })).toBe(true);
  });

  it('returns true on the upper boundary', () => {
    expect(inRange('2026-05-31', { start: '2026-05-01', end: '2026-05-31' })).toBe(true);
  });

  it('returns true strictly inside', () => {
    expect(inRange('2026-05-15', { start: '2026-05-01', end: '2026-05-31' })).toBe(true);
  });

  it('returns false before the range', () => {
    expect(inRange('2026-04-30', { start: '2026-05-01', end: '2026-05-31' })).toBe(false);
  });

  it('returns false after the range', () => {
    expect(inRange('2026-06-01', { start: '2026-05-01', end: '2026-05-31' })).toBe(false);
  });
});
