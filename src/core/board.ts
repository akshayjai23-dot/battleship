import { allCoords, coordsEqual, isOnBoard, toKey } from './coords';
import { isFleetComplete, isSunk, specFor, unplacedKinds } from './fleet';
import { pick, type Rng } from './rng';
import type {
  Coord,
  Fleet,
  Orientation,
  PlacementError,
  PlayerBoard,
  Ship,
  ShipKind,
  ShotOutcome,
} from './types';

export const ORIENTATIONS: readonly Orientation[] = ['horizontal', 'vertical'];

export function emptyBoard(): PlayerBoard {
  return { fleet: [], shots: {} };
}

/** The cells a ship occupies, from its origin outwards. */
export function shipCells(ship: Pick<Ship, 'origin' | 'orientation' | 'size'>): Coord[] {
  const { origin, orientation, size } = ship;
  return Array.from({ length: size }, (_, offset) =>
    orientation === 'horizontal'
      ? { row: origin.row, col: origin.col + offset }
      : { row: origin.row + offset, col: origin.col },
  );
}

export function fleetCells(fleet: Fleet): Coord[] {
  return fleet.flatMap(shipCells);
}

export function shipAt(fleet: Fleet, coord: Coord): Ship | undefined {
  return fleet.find((ship) => shipCells(ship).some((cell) => coordsEqual(cell, coord)));
}

/**
 * Whether a ship of `kind` may be placed here. Returns the reason when it may not, so
 * the UI can explain the refusal instead of silently doing nothing.
 */
export function placementError(
  fleet: Fleet,
  kind: ShipKind,
  origin: Coord,
  orientation: Orientation,
): PlacementError | undefined {
  if (fleet.some((ship) => ship.kind === kind)) return 'already-placed';
  const cells = shipCells({ origin, orientation, size: specFor(kind).size });
  if (!cells.every(isOnBoard)) return 'off-board';
  const occupied = new Set(fleetCells(fleet).map(toKey));
  if (cells.some((cell) => occupied.has(toKey(cell)))) return 'overlap';
  return undefined;
}

export function canPlace(
  fleet: Fleet,
  kind: ShipKind,
  origin: Coord,
  orientation: Orientation,
): boolean {
  return placementError(fleet, kind, origin, orientation) === undefined;
}

/** Places a ship, or throws: callers must check `placementError` first. */
export function placeShip(
  fleet: Fleet,
  kind: ShipKind,
  origin: Coord,
  orientation: Orientation,
): Fleet {
  const error = placementError(fleet, kind, origin, orientation);
  if (error) throw new Error(`Cannot place ${kind} at ${toKey(origin)}: ${error}`);
  const size = specFor(kind).size;
  return [
    ...fleet,
    { kind, size, origin, orientation, hits: Array<boolean>(size).fill(false) },
  ];
}

export function removeShip(fleet: Fleet, kind: ShipKind): Fleet {
  return fleet.filter((ship) => ship.kind !== kind);
}

/**
 * Builds a complete legal fleet at random.
 *
 * Rejection sampling can in principle wedge itself, so each ship gets a bounded number
 * of attempts and the whole layout restarts if one runs out. With 17 cells on a 100-cell
 * board this is astronomically unlikely, but "astronomically unlikely" is exactly the
 * bug that shows up in front of an interviewer.
 */
export function randomFleet(rng: Rng): [fleet: Fleet, next: Rng] {
  const MAX_LAYOUT_ATTEMPTS = 50;
  let current = rng;

  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    const result = tryRandomFleet(current);
    current = result.rng;
    if (result.fleet) return [result.fleet, current];
  }
  throw new Error('Could not generate a legal fleet layout');
}

function tryRandomFleet(rng: Rng): { fleet?: Fleet; rng: Rng } {
  const MAX_SHIP_ATTEMPTS = 200;
  let fleet: Fleet = [];
  let current = rng;

  for (const kind of unplacedKinds([])) {
    let placed = false;
    for (let attempt = 0; attempt < MAX_SHIP_ATTEMPTS && !placed; attempt += 1) {
      const [origin, afterOrigin] = pick(current, allCoords());
      const [orientation, afterOrientation] = pick(afterOrigin, ORIENTATIONS);
      current = afterOrientation;
      if (canPlace(fleet, kind, origin, orientation)) {
        fleet = placeShip(fleet, kind, origin, orientation);
        placed = true;
      }
    }
    if (!placed) return { rng: current };
  }
  return { fleet, rng: current };
}

/**
 * Applies a shot to a board.
 *
 * This is the only place a shot may be resolved, and it is the sole authority on whether
 * a shot is legal: duplicate and off-board shots are rejected here and leave the board
 * untouched, so a UI bug cannot turn into a rules bug.
 */
export function applyShot(
  board: PlayerBoard,
  coord: Coord,
): [board: PlayerBoard, outcome: ShotOutcome] {
  if (!isOnBoard(coord)) return [board, { type: 'rejected', reason: 'off-board' }];

  const key = toKey(coord);
  if (board.shots[key]) return [board, { type: 'rejected', reason: 'already-targeted' }];

  const target = shipAt(board.fleet, coord);
  if (!target) {
    return [{ ...board, shots: { ...board.shots, [key]: 'miss' } }, { type: 'miss' }];
  }

  const index = shipCells(target).findIndex((cell) => coordsEqual(cell, coord));
  const damaged: Ship = {
    ...target,
    hits: target.hits.map((hit, i) => hit || i === index),
  };
  const fleet = board.fleet.map((ship) => (ship.kind === target.kind ? damaged : ship));

  return [
    { fleet, shots: { ...board.shots, [key]: 'hit' } },
    isSunk(damaged)
      ? { type: 'sunk', ship: damaged.kind }
      : { type: 'hit', ship: damaged.kind },
  ];
}

export function isReadyToPlay(board: PlayerBoard): boolean {
  return isFleetComplete(board.fleet);
}
