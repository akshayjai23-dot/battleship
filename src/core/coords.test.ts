import { describe, expect, it } from 'vitest';
import {
  allCoords,
  formatCoord,
  fromKey,
  isOnBoard,
  orthogonalNeighbours,
  parseCoord,
  toKey,
} from './coords';

describe('isOnBoard', () => {
  it.each([
    [{ row: 0, col: 0 }, true],
    [{ row: 9, col: 9 }, true],
    [{ row: -1, col: 0 }, false],
    [{ row: 0, col: -1 }, false],
    [{ row: 10, col: 0 }, false],
    [{ row: 0, col: 10 }, false],
  ])('%j -> %s', (coord, expected) => {
    expect(isOnBoard(coord)).toBe(expected);
  });
});

describe('display notation', () => {
  it.each([
    [{ row: 0, col: 0 }, 'A1'],
    [{ row: 3, col: 1 }, 'B4'],
    [{ row: 9, col: 9 }, 'J10'],
  ])('formats %j as %s', (coord, text) => {
    expect(formatCoord(coord)).toBe(text);
  });

  it('round-trips every coordinate on the board', () => {
    for (const coord of allCoords()) {
      expect(parseCoord(formatCoord(coord))).toEqual(coord);
    }
  });

  it('accepts lower case and surrounding whitespace', () => {
    expect(parseCoord(' j10 ')).toEqual({ row: 9, col: 9 });
  });

  it.each(['', 'K1', 'A0', 'A11', 'A', '1A', 'AA', 'B4x'])('rejects %s', (text) => {
    expect(parseCoord(text)).toBeUndefined();
  });
});

describe('cell keys', () => {
  it('round-trips every coordinate on the board', () => {
    for (const coord of allCoords()) {
      expect(fromKey(toKey(coord))).toEqual(coord);
    }
  });

  it('produces a distinct key per coordinate', () => {
    const keys = allCoords().map(toKey);
    expect(new Set(keys).size).toBe(100);
  });

  it('throws on a malformed key', () => {
    expect(() => fromKey('nonsense')).toThrow();
  });
});

describe('allCoords', () => {
  it('covers the whole board', () => {
    expect(allCoords()).toHaveLength(100);
  });
});

describe('orthogonalNeighbours', () => {
  it('returns four neighbours in the middle of the board', () => {
    expect(orthogonalNeighbours({ row: 5, col: 5 })).toHaveLength(4);
  });

  it('clips at corners', () => {
    expect(orthogonalNeighbours({ row: 0, col: 0 })).toEqual([
      { row: 1, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(orthogonalNeighbours({ row: 9, col: 9 })).toHaveLength(2);
  });

  it('clips at edges', () => {
    expect(orthogonalNeighbours({ row: 0, col: 5 })).toHaveLength(3);
  });
});
