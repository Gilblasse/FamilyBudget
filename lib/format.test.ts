import { describe, expect, it } from 'vitest';
import { fmt, signedMoney } from './format';

describe('signedMoney', () => {
  it('renders zero as unsigned $0.00', () => {
    expect(signedMoney(0)).toBe(fmt(0));
  });

  it('prepends + for positive values', () => {
    expect(signedMoney(12.5)).toBe('+$12.50');
  });

  it('prepends − (U+2212) for negative values, not ASCII hyphen', () => {
    expect(signedMoney(-7)).toBe('−$7.00');
  });
});
