import { normalizeBudget } from './seed-utils';

describe('normalizeBudget', () => {
  it('passes through a plain integer', () => {
    expect(normalizeBudget(20000000)).toBe(20000000);
  });

  it('returns null for null input', () => {
    expect(normalizeBudget(null)).toBeNull();
  });

  it('strips a trailing 원 suffix and parses the number', () => {
    expect(normalizeBudget('2000000원')).toBe(2000000);
  });

  it('returns null for a string with no parseable digits', () => {
    expect(normalizeBudget('abc')).toBeNull();
  });
});
