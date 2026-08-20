import { describe, expect, it } from 'vitest';
import {
  FLEET_SPEC,
  TOTAL_SHIP_CELLS,
  isFleetComplete,
  isFleetDestroyed,
  isSunk,
  labelFor,
  remainingShips,
  specFor,
  unplacedKinds,
} from './fleet';
import type { Ship, ShipKind } from './types';

function ship(kind: ShipKind, hits: boolean[]): Ship {
  return {
    kind,
    size: hits.length,
    origin: { row: 0, col: 0 },
    orientation: 'horizontal',
    hits,
  };
}

describe('FLEET_SPEC', () => {
  it('is the standard five-ship fleet', () => {
    expect(FLEET_SPEC.map((s) => [s.kind, s.size])).toEqual([
      ['carrier', 5],
      ['battleship', 4],
      ['cruiser', 3],
      ['submarine', 3],
      ['destroyer', 2],
    ]);
  });

  it('occupies 17 cells in total', () => {
    expect(TOTAL_SHIP_CELLS).toBe(17);
  });

  it('has a unique kind per ship', () => {
    expect(new Set(FLEET_SPEC.map((s) => s.kind)).size).toBe(FLEET_SPEC.length);
  });
});

describe('specFor / labelFor', () => {
  it('looks up a known kind', () => {
    expect(specFor('cruiser').size).toBe(3);
    expect(labelFor('destroyer')).toBe('Destroyer');
  });

  it('throws on an unknown kind rather than returning undefined', () => {
    expect(() => specFor('dinghy' as ShipKind)).toThrow();
  });
});

describe('isSunk', () => {
  it('is false while any segment is undamaged', () => {
    expect(isSunk(ship('destroyer', [true, false]))).toBe(false);
    expect(isSunk(ship('destroyer', [false, false]))).toBe(false);
  });

  it('is true only when every segment is hit', () => {
    expect(isSunk(ship('destroyer', [true, true]))).toBe(true);
  });

  it('is true for the final segment of the largest ship', () => {
    expect(isSunk(ship('carrier', [true, true, true, true, false]))).toBe(false);
    expect(isSunk(ship('carrier', [true, true, true, true, true]))).toBe(true);
  });
});

describe('isFleetDestroyed', () => {
  it('is false while one ship survives', () => {
    const fleet = [ship('destroyer', [true, true]), ship('cruiser', [true, true, false])];
    expect(isFleetDestroyed(fleet)).toBe(false);
  });

  it('is true when all ships are sunk', () => {
    const fleet = [ship('destroyer', [true, true]), ship('cruiser', [true, true, true])];
    expect(isFleetDestroyed(fleet)).toBe(true);
  });

  it('is false for an empty fleet, which is not a victory', () => {
    expect(isFleetDestroyed([])).toBe(false);
  });
});

describe('remainingShips', () => {
  it('excludes sunk ships', () => {
    const alive = ship('cruiser', [false, false, false]);
    expect(remainingShips([ship('destroyer', [true, true]), alive])).toEqual([alive]);
  });
});

describe('placement bookkeeping', () => {
  it('reports every kind as unplaced for an empty fleet', () => {
    expect(unplacedKinds([])).toEqual([
      'carrier',
      'battleship',
      'cruiser',
      'submarine',
      'destroyer',
    ]);
    expect(isFleetComplete([])).toBe(false);
  });

  it('reports the remaining kinds in canonical order', () => {
    const fleet = [ship('cruiser', [false, false, false])];
    expect(unplacedKinds(fleet)).toEqual([
      'carrier',
      'battleship',
      'submarine',
      'destroyer',
    ]);
  });

  it('is complete once all five kinds are placed', () => {
    const fleet = FLEET_SPEC.map((spec) => ship(spec.kind, Array(spec.size).fill(false)));
    expect(isFleetComplete(fleet)).toBe(true);
  });
});
