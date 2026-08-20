import { describe, expect, it } from 'vitest';
import { placeShip, shipCells } from '../core/board';
import { parseCoord, toKey } from '../core/coords';
import type { Coord, PlayerBoard, ShotMark } from '../core/types';
import { describeCell, enemyCells, ownCells, type CellView } from './cells';

function at(label: string): Coord {
  const coord = parseCoord(label);
  if (!coord) throw new Error(`bad coordinate ${label}`);
  return coord;
}

function cellAt(cells: readonly CellView[], label: string): CellView {
  const target = at(label);
  const cell = cells.find((candidate) => toKey(candidate.coord) === toKey(target));
  if (!cell) throw new Error(`no cell at ${label}`);
  return cell;
}

/** A destroyer at A1–B1, damaged as described. */
function boardWith(marks: Record<string, ShotMark>): PlayerBoard {
  let fleet = placeShip([], 'destroyer', at('A1'), 'vertical');
  const shots: Record<string, ShotMark> = {};
  for (const [label, mark] of Object.entries(marks)) {
    const coord = at(label);
    shots[toKey(coord)] = mark;
    if (mark === 'hit') {
      fleet = fleet.map((ship) => {
        const index = shipCells(ship).findIndex((cell) => toKey(cell) === toKey(coord));
        if (index < 0) return ship;
        return { ...ship, hits: ship.hits.map((hit, i) => hit || i === index) };
      });
    }
  }
  return { fleet, shots };
}

describe('ownCells', () => {
  it('shows the player their own undamaged ships', () => {
    const cells = ownCells(boardWith({}), undefined);
    expect(cellAt(cells, 'A1').state).toBe('ship');
    expect(cellAt(cells, 'A3').state).toBe('water');
  });

  it('shows hits, misses and sunk ships distinctly', () => {
    const partly = ownCells(boardWith({ A1: 'hit', C3: 'miss' }), undefined);
    expect(cellAt(partly, 'A1').state).toBe('hit');
    expect(cellAt(partly, 'C3').state).toBe('miss');

    const sunk = ownCells(boardWith({ A1: 'hit', A2: 'hit' }), undefined);
    expect(cellAt(sunk, 'A1').state).toBe('sunk');
    expect(cellAt(sunk, 'A2').state).toBe('sunk');
  });

  it('draws a legal placement preview over water', () => {
    const cells = ownCells(boardWith({}), {
      cells: [at('E5'), at('E6')],
      legal: true,
    });
    expect(cellAt(cells, 'E5').state).toBe('preview');
    expect(cellAt(cells, 'E6').state).toBe('preview');
  });

  it('marks an illegal placement preview differently', () => {
    const cells = ownCells(boardWith({}), { cells: [at('E5')], legal: false });
    expect(cellAt(cells, 'E5').state).toBe('invalid');
  });

  it('never lets a preview hide a ship that is already placed', () => {
    // Regression: the preview for the *next* ship used to be painted over the ship the
    // player had just placed, so their own fleet vanished under an orange overlay.
    const cells = ownCells(boardWith({}), {
      cells: [at('A1'), at('A2'), at('A3')],
      legal: false,
    });
    expect(cellAt(cells, 'A1').state).toBe('ship');
    expect(cellAt(cells, 'A2').state).toBe('ship');
    expect(cellAt(cells, 'A3').state).toBe('invalid');
  });

  it('ignores preview squares that fall off the board', () => {
    const cells = ownCells(boardWith({}), {
      cells: [at('J10'), { row: 10, col: 9 }],
      legal: false,
    });
    expect(cells).toHaveLength(100);
    expect(cellAt(cells, 'J10').state).toBe('invalid');
  });
});

describe('enemyCells', () => {
  it('never reveals an unhit enemy ship', () => {
    const cells = enemyCells(boardWith({}));
    expect(cells.every((cell) => cell.state === 'water')).toBe(true);
  });

  it('reveals a square only once it has been fired at', () => {
    const cells = enemyCells(boardWith({ A1: 'hit', C3: 'miss' }));
    expect(cellAt(cells, 'A1').state).toBe('hit');
    expect(cellAt(cells, 'A2').state).toBe('water');
    expect(cellAt(cells, 'C3').state).toBe('miss');
  });

  it('marks the whole ship as sunk once it goes down', () => {
    const cells = enemyCells(boardWith({ A1: 'hit', A2: 'hit' }));
    expect(cellAt(cells, 'A1').state).toBe('sunk');
    expect(cellAt(cells, 'A2').state).toBe('sunk');
  });
});

describe('describeCell', () => {
  it('names the square and its state for screen readers', () => {
    const cells = ownCells(boardWith({ A1: 'hit' }), undefined);
    expect(describeCell(cellAt(cells, 'A1'))).toBe('A1, hit');
    expect(describeCell(cellAt(cells, 'J10'))).toBe('J10, water');
  });
});
