import {
  chooseShot,
  emptyMemory,
  rememberShot,
  type AiMemory,
  type OpponentView,
  type StrategyName,
} from './ai';
import {
  applyShot,
  emptyBoard,
  placeShip,
  placementError,
  randomFleet,
  removeShip,
} from './board';
import { formatCoord } from './coords';
import { isFleetComplete, isFleetDestroyed, labelFor } from './fleet';
import { createRng, type Rng } from './rng';
import type {
  Coord,
  Orientation,
  PlayerBoard,
  ShipKind,
  ShotOutcome,
  Side,
} from './types';

export type Phase =
  | { readonly name: 'setup' }
  | { readonly name: 'playerTurn' }
  | { readonly name: 'aiTurn' }
  | { readonly name: 'gameOver'; readonly winner: Side };

export type LogEntry = {
  readonly side: Side;
  readonly coord: Coord;
  readonly outcome: Exclude<ShotOutcome, { type: 'rejected' }>;
};

export type GameState = {
  readonly phase: Phase;
  /** The human's board: their fleet, and the shots the AI has fired at it. */
  readonly human: PlayerBoard;
  /** The AI's board: its fleet, and the shots the human has fired at it. */
  readonly ai: PlayerBoard;
  readonly aiMemory: AiMemory;
  readonly strategy: StrategyName;
  readonly rng: Rng;
  readonly seed: number;
  /** The orientation the next manually placed ship will use. */
  readonly placementOrientation: Orientation;
  readonly log: readonly LogEntry[];
  /** Feedback for the last rejected action, so the UI can explain a refusal. */
  readonly notice: string | undefined;
  /** Incremented on every accepted move; lets the UI key effects to a turn. */
  readonly turn: number;
};

export type Action =
  | { readonly type: 'newGame'; readonly seed?: number }
  | {
      readonly type: 'placeShip';
      readonly kind: ShipKind;
      readonly origin: Coord;
      readonly orientation: Orientation;
    }
  | { readonly type: 'removeShip'; readonly kind: ShipKind }
  | { readonly type: 'setPlacementOrientation'; readonly orientation: Orientation }
  | { readonly type: 'randomizePlacement' }
  | { readonly type: 'resetPlacement' }
  | { readonly type: 'startGame' }
  | { readonly type: 'playerFire'; readonly coord: Coord }
  | { readonly type: 'aiFire' };

export const DEFAULT_STRATEGY: StrategyName = 'huntTarget';

export function createGame(
  seed: number,
  strategy: StrategyName = DEFAULT_STRATEGY,
): GameState {
  const [aiFleet, rng] = randomFleet(createRng(seed));
  return {
    phase: { name: 'setup' },
    human: emptyBoard(),
    ai: { fleet: aiFleet, shots: {} },
    aiMemory: emptyMemory,
    strategy,
    rng,
    seed,
    placementOrientation: 'horizontal',
    log: [],
    notice: undefined,
    turn: 0,
  };
}

/** The AI only ever sees the shots it has fired; never the human's fleet. */
function viewOf(board: PlayerBoard): OpponentView {
  return { shots: board.shots };
}

function reject(state: GameState, notice: string): GameState {
  return { ...state, notice };
}

function describe(outcome: LogEntry['outcome']): string {
  switch (outcome.type) {
    case 'miss':
      return 'Miss';
    case 'hit':
      return 'Hit';
    case 'sunk':
      return `Sunk the ${labelFor(outcome.ship)}`;
  }
}

/**
 * The single authority on what may happen next.
 *
 * Every rule guard lives here rather than in the UI: disabled buttons are cosmetic, and
 * an action that arrives at the wrong time — a duplicate shot, a click during the AI's
 * turn, a stale timer firing after the game ended — is rejected and leaves the state
 * unchanged.
 */
export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'newGame':
      return createGame(action.seed ?? state.seed + 1, state.strategy);

    case 'setPlacementOrientation':
      if (state.phase.name !== 'setup') return state;
      return { ...state, placementOrientation: action.orientation, notice: undefined };

    case 'placeShip': {
      if (state.phase.name !== 'setup') return state;
      const error = placementError(
        state.human.fleet,
        action.kind,
        action.origin,
        action.orientation,
      );
      if (error === 'off-board') {
        return reject(state, `The ${labelFor(action.kind)} does not fit there.`);
      }
      if (error === 'overlap') {
        return reject(state, `The ${labelFor(action.kind)} would overlap another ship.`);
      }
      if (error === 'already-placed') {
        return reject(state, `The ${labelFor(action.kind)} is already on the board.`);
      }
      return {
        ...state,
        human: {
          ...state.human,
          fleet: placeShip(
            state.human.fleet,
            action.kind,
            action.origin,
            action.orientation,
          ),
        },
        notice: undefined,
      };
    }

    case 'removeShip': {
      if (state.phase.name !== 'setup') return state;
      return {
        ...state,
        human: { ...state.human, fleet: removeShip(state.human.fleet, action.kind) },
        notice: undefined,
      };
    }

    case 'randomizePlacement': {
      if (state.phase.name !== 'setup') return state;
      const [fleet, rng] = randomFleet(state.rng);
      return { ...state, human: { ...state.human, fleet }, rng, notice: undefined };
    }

    case 'resetPlacement':
      if (state.phase.name !== 'setup') return state;
      return { ...state, human: emptyBoard(), notice: undefined };

    case 'startGame':
      if (state.phase.name !== 'setup') return state;
      if (!isFleetComplete(state.human.fleet)) {
        return reject(state, 'Place all five ships before starting.');
      }
      return { ...state, phase: { name: 'playerTurn' }, notice: undefined };

    case 'playerFire': {
      if (state.phase.name !== 'playerTurn') return state;
      const [board, outcome] = applyShot(state.ai, action.coord);
      if (outcome.type === 'rejected') {
        return reject(
          state,
          outcome.reason === 'already-targeted'
            ? `You have already fired at ${formatCoord(action.coord)}.`
            : 'That square is off the board.',
        );
      }
      const won = isFleetDestroyed(board.fleet);
      return {
        ...state,
        ai: board,
        // The win is registered before the AI is ever asked to reply, so a defeated
        // opponent cannot take one last shot.
        phase: won ? { name: 'gameOver', winner: 'player' } : { name: 'aiTurn' },
        log: [...state.log, { side: 'player', coord: action.coord, outcome }],
        notice: describe(outcome),
        turn: state.turn + 1,
      };
    }

    case 'aiFire': {
      // Guarded here, not in the component: a double-dispatched or stale timer is a
      // no-op by construction rather than by timing luck.
      if (state.phase.name !== 'aiTurn') return state;
      const [coord, rng] = chooseShot(
        state.strategy,
        viewOf(state.human),
        state.aiMemory,
        state.rng,
      );
      const [board, outcome] = applyShot(state.human, coord);
      if (outcome.type === 'rejected') {
        throw new Error(`The AI fired an illegal shot at ${formatCoord(coord)}`);
      }
      const lost = isFleetDestroyed(board.fleet);
      return {
        ...state,
        human: board,
        rng,
        aiMemory: rememberShot(state.aiMemory, coord, outcome, viewOf(board)),
        phase: lost ? { name: 'gameOver', winner: 'ai' } : { name: 'playerTurn' },
        log: [...state.log, { side: 'ai', coord, outcome }],
        notice: `${describe(outcome)} at ${formatCoord(coord)}`,
        turn: state.turn + 1,
      };
    }
  }
}
