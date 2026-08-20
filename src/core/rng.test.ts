import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, pick, type Rng } from './rng';

function draw(count: number, rng: Rng): number[] {
  const values: number[] = [];
  let current = rng;
  for (let i = 0; i < count; i += 1) {
    const [value, next] = nextFloat(current);
    values.push(value);
    current = next;
  }
  return values;
}

describe('createRng', () => {
  it('accepts negative and fractional-free seeds', () => {
    expect(() => createRng(-1)).not.toThrow();
    expect(createRng(-1).state).toBeGreaterThanOrEqual(0);
  });
});

describe('determinism', () => {
  it('produces the same sequence for the same seed', () => {
    expect(draw(20, createRng(42))).toEqual(draw(20, createRng(42)));
  });

  it('produces different sequences for different seeds', () => {
    expect(draw(20, createRng(42))).not.toEqual(draw(20, createRng(43)));
  });

  it('does not mutate the generator it is given', () => {
    const rng = createRng(7);
    nextFloat(rng);
    nextFloat(rng);
    expect(rng.state).toBe(createRng(7).state);
  });
});

describe('nextFloat', () => {
  it('stays within [0, 1)', () => {
    for (const value of draw(1000, createRng(1))) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('nextInt', () => {
  it('stays within [0, max)', () => {
    let rng = createRng(3);
    for (let i = 0; i < 1000; i += 1) {
      const [value, next] = nextInt(rng, 10);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
      rng = next;
    }
  });

  it('covers the whole range over many draws', () => {
    const seen = new Set<number>();
    let rng = createRng(5);
    for (let i = 0; i < 500; i += 1) {
      const [value, next] = nextInt(rng, 10);
      seen.add(value);
      rng = next;
    }
    expect(seen.size).toBe(10);
  });

  it.each([0, -1, 2.5])('rejects a bound of %s', (bound) => {
    expect(() => nextInt(createRng(1), bound)).toThrow();
  });
});

describe('pick', () => {
  it('returns an element of the list', () => {
    const items = ['a', 'b', 'c'];
    const [value] = pick(createRng(9), items);
    expect(items).toContain(value);
  });

  it('throws on an empty list rather than returning undefined', () => {
    expect(() => pick(createRng(1), [])).toThrow();
  });
});
