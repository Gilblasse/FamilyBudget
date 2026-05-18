import { describe, it, expect } from 'vitest';
import { actionVariant, incomeStatusVariant, priorityVariant } from './badges';

describe('actionVariant', () => {
  it('returns success for pay-full (resolves former bills-table/summary disagreement)', () => {
    expect(actionVariant('pay-full')).toBe('success');
  });

  it('returns warning for partial and reduce', () => {
    expect(actionVariant('partial')).toBe('warning');
    expect(actionVariant('reduce')).toBe('warning');
  });

  it('returns danger for skip and delay', () => {
    expect(actionVariant('skip')).toBe('danger');
    expect(actionVariant('delay')).toBe('danger');
  });
});

describe('incomeStatusVariant', () => {
  it('returns success for received', () => {
    expect(incomeStatusVariant('received')).toBe('success');
  });

  it('returns info for confirmed', () => {
    expect(incomeStatusVariant('confirmed')).toBe('info');
  });

  it('returns warning for pending', () => {
    expect(incomeStatusVariant('pending')).toBe('warning');
  });

  it('returns neutral for expected', () => {
    expect(incomeStatusVariant('expected')).toBe('neutral');
  });
});

describe('priorityVariant', () => {
  it('returns danger for crit', () => {
    expect(priorityVariant('crit')).toBe('danger');
  });

  it('returns warning for imp', () => {
    expect(priorityVariant('imp')).toBe('warning');
  });

  it('returns info for opt', () => {
    expect(priorityVariant('opt')).toBe('info');
  });

  it('returns neutral for flex', () => {
    expect(priorityVariant('flex')).toBe('neutral');
  });
});
