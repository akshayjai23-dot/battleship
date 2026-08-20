import { describe, expect, it } from 'vitest';
import {
  applyShot,
  canPlace,
  emptyBoard,
  fleetCells,
  placeShip,
  placementError,
  randomFleet,
  removeShip,
  shipAt,
  shipCells,
} from './board';
import { allCoords, toKey } from './coords';
import { FLEET_SPEC, TOTAL_SHIP_CELLS, isFleetComplete, isSunk } from './fleet';
import { createRng } from './rng';
import type { Fleet, PlayerBoard } from './types';

describe('shipCells', () => {
  it('runs left to right when horizontal', () => {
    expect(
      shipCells({ origin: { row: 2, col: 3 }, orientation: 'horizontal', size: 3 }),
    ).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ]);
  });

  it('runs top to bottom when vertical', () => {
    expect(
      shipCells({ origin: { row: 2, col: 3 }, orientation: 'vertical', size: 3 }),
    ).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
    ]);
  });
});

describe('placementError', () => {
  it('allows a ship that ends exactly on the last column', () => {
    expect(canPlace([], 'destroyer', { row: 0, col: 8 }, 'horizontal')).toBe(true);
  });

  it('rejects a ship that overhangs the right edge by one', () => {
    expect(placementError([], 'destroyer', { row: 0, col: 9 }, 'horizontal')).toBe(
      'off-board',
    );
  });

  it('allows a ship that ends exactly on the last row', () => {
    expect(canPlace([], 'carrier', { row: 5, col: 0 }, 'vertical')).toBe(true);
  });

  it('rejects a ship that overhangs the bottom edge by one', () => {
    expect(placementError([], 'carrier', { row: 6, col: 0 }, 'vertical')).toBe(
      'off-board',
    );
  });

  it('rejects an origin that is off the board entirely', () => {
    expect(placementError([], 'destroyer', { row: -1, col: 0 }, 'horizontal')).toBe(
      'off-board',
    );
  });

  it('rejects a placement overlapping an existing ship', () => {
    const fleet = placeShip([], 'carrier', { row: 4, col: 0 }, 'horizontal');
    expect(placementError(fleet, 'cruiser', { row: 4, col: 4 }, 'vertical')).toBe(
      'overlap',
    );
  });

  it('allows ships to touch without overlapping', () => {
    const fleet = placeShip([], 'carrier', { row: 4, col: 0 }, 'horizontal');
    expect(canPlace(fleet, 'cruiser', { row: 5, col: 0 }, 'horizontal')).toBe(true);
  });

  it('rejects placing the same kind twice', () => {
    const fleet = placeShip([], 'cruiser', { row: 0, col: 0 }, 'horizontal');
    expect(placementError(fleet, 'cruiser', { row: 5, col: 5 }, 'horizontal')).toBe(
      'already-placed',
    );
  });
});

describe('placeShip', () => {
  it('adds an undamaged ship of the right size', () => {
    const [ship] = placeShip([], 'battleship', { row: 1, col: 1 }, 'vertical');
    expect(ship).toMatchObject({ kind: 'battleship', size: 4 });
    expect(ship?.hits).toEqual([false, false, false, false]);
  });

  it('does not mutate the fleet it is given', () => {
    const fleet: Fleet = [];
    placeShip(fleet, 'cruiser', { row: 0, col: 0 }, 'horizontal');
    expect(fleet).toEqual([]);
  });

  it('throws rather than placing an illegal ship', () => {
    expect(() => placeShip([], 'carrier', { row: 9, col: 9 }, 'horizontal')).toThrow();
  });
});

describe('removeShip', () => {
  it('removes only the named kind', () => {
    let fleet = placeShip([], 'cruiser', { row: 0, col: 0 }, 'horizontal');
    fleet = placeShip(fleet, 'destroyer', { row: 2, col: 0 }, 'horizontal');
    expect(removeShip(fleet, 'cruiser').map((s) => s.kind)).toEqual(['destroyer']);
  });
});

describe('shipAt', () => {
  const fleet = placeShip([], 'cruiser', { row: 3, col: 3 }, 'horizontal');

  it('finds a ship on each of its cells', () => {
    for (const cell of shipCells(fleet[0]!)) {
      expect(shipAt(fleet, cell)?.kind).toBe('cruiser');
    }
  });

  it('returns undefined for empty water, including adjacent cells', () => {
    expect(shipAt(fleet, { row: 3, col: 2 })).toBeUndefined();
    expect(shipAt(fleet, { row: 3, col: 6 })).toBeUndefined();
    expect(shipAt(fleet, { row: 4, col: 3 })).toBeUndefined();
  });
});

describe('randomFleet', () => {
  it('always produces a complete legal fleet', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const [fleet] = randomFleet(createRng(seed));
      const cells = fleetCells(fleet);
      expect(isFleetComplete(fleet)).toBe(true);
      expect(cells).toHaveLength(TOTAL_SHIP_CELLS);
      expect(new Set(cells.map(toKey)).size).toBe(TOTAL_SHIP_CELLS);
      expect(cells.every((c) => c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10));
      expect(fleet.every((ship) => ship.hits.every((hit) => hit === false))).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(randomFleet(createRng(99))[0]).toEqual(randomFleet(createRng(99))[0]);
  });

  it('advances the generator, so two draws differ', () => {
    const [first, next] = randomFleet(createRng(99));
    expect(randomFleet(next)[0]).not.toEqual(first);
  });
});

describe('applyShot', () => {
  function boardWithCruiser(): PlayerBoard {
    return {
      fleet: placeShip([], 'cruiser', { row: 3, col: 3 }, 'horizontal'),
      shots: {},
    };
  }

  it('records a miss on empty water', () => {
    const [next, outcome] = applyShot(boardWithCruiser(), { row: 0, col: 0 });
    expect(outcome).toEqual({ type: 'miss' });
    expect(next.shots[toKey({ row: 0, col: 0 })]).toBe('miss');
  });

  it('records a hit and damages only the targeted segment', () => {
    const [next, outcome] = applyShot(boardWithCruiser(), { row: 3, col: 4 });
    expect(outcome).toEqual({ type: 'hit', ship: 'cruiser' });
    expect(next.fleet[0]?.hits).toEqual([false, true, false]);
    expect(next.shots[toKey({ row: 3, col: 4 })]).toBe('hit');
  });

  it('reports sunk only on the final segment', () => {
    let board = boardWithCruiser();
    let outcome;
    [board, outcome] = applyShot(board, { row: 3, col: 3 });
    expect(outcome.type).toBe('hit');
    [board, outcome] = applyShot(board, { row: 3, col: 5 });
    expect(outcome.type).toBe('hit');
    [board, outcome] = applyShot(board, { row: 3, col: 4 });
    expect(outcome).toEqual({ type: 'sunk', ship: 'cruiser' });
    expect(isSunk(board.fleet[0]!)).toBe(true);
  });

  it('rejects a repeated shot and leaves the board unchanged', () => {
    const [afterFirst] = applyShot(boardWithCruiser(), { row: 3, col: 3 });
    const [afterSecond, outcome] = applyShot(afterFirst, { row: 3, col: 3 });
    expect(outcome).toEqual({ type: 'rejected', reason: 'already-targeted' });
    expect(afterSecond).toBe(afterFirst);
  });

  it('rejects a repeated miss too', () => {
    const [afterFirst] = applyShot(boardWithCruiser(), { row: 0, col: 0 });
    const [, outcome] = applyShot(afterFirst, { row: 0, col: 0 });
    expect(outcome).toEqual({ type: 'rejected', reason: 'already-targeted' });
  });

  it('rejects an off-board shot', () => {
    const board = boardWithCruiser();
    const [next, outcome] = applyShot(board, { row: -1, col: 0 });
    expect(outcome).toEqual({ type: 'rejected', reason: 'off-board' });
    expect(next).toBe(board);
  });

  it('does not mutate the board it is given', () => {
    const board = boardWithCruiser();
    applyShot(board, { row: 3, col: 3 });
    expect(board.shots).toEqual({});
    expect(board.fleet[0]?.hits).toEqual([false, false, false]);
  });

  it('leaves other ships untouched when one is hit', () => {
    let fleet = placeShip([], 'cruiser', { row: 3, col: 3 }, 'horizontal');
    fleet = placeShip(fleet, 'destroyer', { row: 4, col: 3 }, 'horizontal');
    const [next] = applyShot({ fleet, shots: {} }, { row: 3, col: 3 });
    expect(next.fleet[1]?.hits).toEqual([false, false]);
  });

  it('sinks exactly one of two adjacent ships', () => {
    let fleet = placeShip([], 'destroyer', { row: 0, col: 0 }, 'horizontal');
    fleet = placeShip(fleet, 'cruiser', { row: 0, col: 2 }, 'horizontal');
    let board: PlayerBoard = { fleet, shots: {} };
    [board] = applyShot(board, { row: 0, col: 0 });
    const [after, outcome] = applyShot(board, { row: 0, col: 1 });
    expect(outcome).toEqual({ type: 'sunk', ship: 'destroyer' });
    expect(isSunk(after.fleet[1]!)).toBe(false);
  });

  it('can sink an entire fleet, cell by cell', () => {
    const [fleet] = randomFleet(createRng(11));
    let board: PlayerBoard = { fleet, shots: {} };
    for (const coord of allCoords()) [board] = applyShot(board, coord);
    expect(board.fleet.every(isSunk)).toBe(true);
    expect(Object.keys(board.shots)).toHaveLength(100);
    expect(Object.values(board.shots).filter((m) => m === 'hit')).toHaveLength(
      TOTAL_SHIP_CELLS,
    );
  });
});

describe('emptyBoard', () => {
  it('starts with no ships and no shots', () => {
    expect(emptyBoard()).toEqual({ fleet: [], shots: {} });
    expect(FLEET_SPEC.length).toBe(5);
  });
});
