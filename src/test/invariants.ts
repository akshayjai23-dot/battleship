import { fleetCells, shipCells, shipAt } from '../core/board';
import { isOnBoard, toKey } from '../core/coords';
import { FLEET_SPEC, TOTAL_SHIP_CELLS, isFleetDestroyed, isSunk } from '../core/fleet';
import type { GameState } from '../core/game';
import type { PlayerBoard } from '../core/types';

/**
 * The properties that must hold after *every* transition, for both sides.
 *
 * These are asserted after each move of every property-based game, so a rules bug shows
 * up as a violated invariant with a reproducible seed rather than as a strange board.
 */
export function checkInvariants(state: GameState): void {
  checkBoard(state.human, 'human');
  checkBoard(state.ai, 'ai');
  checkPhase(state);
}

function fail(message: string): never {
  throw new Error(`Invariant violated: ${message}`);
}

function checkBoard(board: PlayerBoard, who: string): void {
  const kinds = board.fleet.map((ship) => ship.kind);

  // Fleet completeness is only required once placement has finished; during setup a
  // partial fleet is legal, but it may never contain a duplicate or unknown ship.
  if (new Set(kinds).size !== kinds.length) fail(`${who} has a duplicate ship`);
  for (const ship of board.fleet) {
    const spec = FLEET_SPEC.find((candidate) => candidate.kind === ship.kind);
    if (!spec) fail(`${who} has an unknown ship ${ship.kind}`);
    if (ship.size !== spec.size) fail(`${who}'s ${ship.kind} has the wrong size`);
    if (ship.hits.length !== ship.size) fail(`${who}'s ${ship.kind} has stray damage`);
    if (!shipCells(ship).every(isOnBoard)) fail(`${who}'s ${ship.kind} is off the board`);
    if (isSunk(ship) !== ship.hits.every(Boolean)) fail(`${who}'s sunk flag disagrees`);
  }

  const cells = fleetCells(board.fleet);
  if (new Set(cells.map(toKey)).size !== cells.length) fail(`${who}'s ships overlap`);
  if (board.fleet.length === FLEET_SPEC.length && cells.length !== TOTAL_SHIP_CELLS) {
    fail(`${who}'s complete fleet covers ${cells.length} cells`);
  }

  for (const [key, mark] of Object.entries(board.shots)) {
    const [row, col] = key.split(',').map(Number) as [number, number];
    const coord = { row, col };
    if (!isOnBoard(coord)) fail(`${who} has a shot recorded off the board at ${key}`);
    const ship = shipAt(board.fleet, coord);
    // A hit must correspond to a ship, a miss to open water, and the ship's own damage
    // record must agree with the mark on the grid.
    if (mark === 'hit' && !ship) fail(`${who} has a hit at ${key} with no ship there`);
    if (mark === 'miss' && ship) fail(`${who} has a miss at ${key} on top of a ship`);
    if (mark === 'hit' && ship) {
      const index = shipCells(ship).findIndex((cell) => toKey(cell) === key);
      if (!ship.hits[index]) fail(`${who}'s ${ship.kind} is undamaged at a hit cell`);
    }
  }

  for (const ship of board.fleet) {
    shipCells(ship).forEach((cell, index) => {
      if (ship.hits[index] && board.shots[toKey(cell)] !== 'hit') {
        fail(`${who}'s ${ship.kind} records damage at an unshot cell`);
      }
    });
  }
}

function checkPhase(state: GameState): void {
  const humanLost = isFleetDestroyed(state.human.fleet);
  const aiLost = isFleetDestroyed(state.ai.fleet);

  if (humanLost && aiLost) fail('both fleets are destroyed');
  if (state.phase.name === 'gameOver') {
    const winner = state.phase.winner;
    if (winner === 'player' && !aiLost) fail('player won with the AI fleet afloat');
    if (winner === 'ai' && !humanLost) fail('AI won with the human fleet afloat');
  } else if (humanLost || aiLost) {
    fail(`a fleet is destroyed but the phase is ${state.phase.name}`);
  }

  const shots =
    Object.keys(state.human.shots).length + Object.keys(state.ai.shots).length;
  if (shots !== state.log.length) fail('the log and the boards disagree on shot count');
  if (state.log.length > 200) fail('more shots than there are cells on both boards');
}
