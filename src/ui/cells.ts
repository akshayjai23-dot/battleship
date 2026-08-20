import { shipAt, shipCells } from '../core/board';
import { allCoords, formatCoord, toKey } from '../core/coords';
import { isSunk } from '../core/fleet';
import type { Coord, PlayerBoard } from '../core/types';

/**
 * What a square looks like. Derived from the fleet and the shot record on every render —
 * never stored — so the board on screen cannot drift out of step with the game state.
 */
export type CellState =
  'water' | 'ship' | 'miss' | 'hit' | 'sunk' | 'preview' | 'invalid';

export type CellView = {
  readonly coord: Coord;
  readonly key: string;
  /** Player-facing notation, e.g. "B4". */
  readonly name: string;
  readonly state: CellState;
};

const DESCRIPTIONS: Record<CellState, string> = {
  water: 'water',
  ship: 'your ship',
  miss: 'miss',
  hit: 'hit',
  sunk: 'sunk',
  preview: 'placement preview',
  invalid: 'invalid placement',
};

export function describeCell(cell: CellView): string {
  return `${cell.name}, ${DESCRIPTIONS[cell.state]}`;
}

/** The player's own board: ships are visible, because they are theirs. */
export function ownCells(board: PlayerBoard, preview: Preview | undefined): CellView[] {
  const previewed = previewStates(preview);
  return allCoords().map((coord) => {
    const key = toKey(coord);
    const ship = shipAt(board.fleet, coord);
    const mark = board.shots[key];
    // Order matters: damage, then the player's own ships, then the preview. A preview
    // must never paint over something real, or the fleet appears to vanish under it.
    const state: CellState =
      mark === 'hit'
        ? ship && isSunk(ship)
          ? 'sunk'
          : 'hit'
        : mark === 'miss'
          ? 'miss'
          : ship
            ? 'ship'
            : (previewed[key] ?? 'water');
    return { coord, key, name: formatCoord(coord), state };
  });
}

/**
 * The opponent's board: only the player's own shot results are visible. A ship is
 * revealed one square at a time, and only fully once it is sunk.
 */
export function enemyCells(board: PlayerBoard): CellView[] {
  const sunkCells = new Set(board.fleet.filter(isSunk).flatMap(shipCells).map(toKey));
  return allCoords().map((coord) => {
    const key = toKey(coord);
    const mark = board.shots[key];
    const state: CellState =
      mark === 'hit'
        ? sunkCells.has(key)
          ? 'sunk'
          : 'hit'
        : mark === 'miss'
          ? 'miss'
          : 'water';
    return { coord, key, name: formatCoord(coord), state };
  });
}

export type Preview = {
  readonly cells: readonly Coord[];
  readonly legal: boolean;
};

function previewStates(preview: Preview | undefined): Record<string, CellState> {
  if (!preview) return {};
  const state: CellState = preview.legal ? 'preview' : 'invalid';
  return Object.fromEntries(preview.cells.map((coord) => [toKey(coord), state]));
}
