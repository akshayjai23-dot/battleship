import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../test/invariants';
import { chooseShot, emptyMemory, rememberShot, type StrategyName } from './ai';
import { fleetCells, randomFleet, shipCells } from './board';
import { allCoords, isOnBoard, toKey } from './coords';
import { FLEET_SPEC, TOTAL_SHIP_CELLS, isFleetComplete } from './fleet';
import { createGame, reduce, type Action, type GameState } from './game';
import { createRng } from './rng';
import type { Coord } from './types';

const seeds = fc.integer({ min: 0, max: 2 ** 31 - 1 });
/** 100 cells per board, so no legal game can exceed 200 accepted shots. */
const MAX_SHOTS = 200;

/**
 * Plays a whole game to completion: the AI drives both sides, so the property tests
 * exercise the real reducer rather than a scripted move list.
 */
function playOut(
  seed: number,
  humanStrategy: StrategyName,
  onStep: (state: GameState) => void = () => {},
): GameState {
  let state = reduce(createGame(seed), { type: 'randomizePlacement' });
  state = reduce(state, { type: 'startGame' });

  // The human side gets its own AI instance, with its own memory and RNG stream.
  let humanMemory = emptyMemory;
  let humanRng = createRng(seed ^ 0x5f3759df);
  let guard = 0;

  while (state.phase.name !== 'gameOver') {
    if (guard++ > MAX_SHOTS + 1) throw new Error('game did not terminate');

    if (state.phase.name === 'playerTurn') {
      const [coord, next] = chooseShot(
        humanStrategy,
        { shots: state.ai.shots },
        humanMemory,
        humanRng,
      );
      humanRng = next;
      state = reduce(state, { type: 'playerFire', coord });
      const outcome = state.log[state.log.length - 1]?.outcome;
      if (outcome) {
        humanMemory = rememberShot(humanMemory, coord, outcome, {
          shots: state.ai.shots,
        });
      }
    } else {
      state = reduce(state, { type: 'aiFire' });
    }
    onStep(state);
  }
  return state;
}

describe('property: fleet generation', () => {
  it('produces a complete, legal, on-board fleet for any seed', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const [fleet] = randomFleet(createRng(seed));
        expect(isFleetComplete(fleet)).toBe(true);
        const cells = fleetCells(fleet);
        expect(cells).toHaveLength(TOTAL_SHIP_CELLS);
        expect(new Set(cells.map(toKey)).size).toBe(TOTAL_SHIP_CELLS);
        expect(cells.every(isOnBoard)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('places every ship contiguously along one axis', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const [fleet] = randomFleet(createRng(seed));
        for (const ship of fleet) {
          const cells = shipCells(ship);
          expect(cells).toHaveLength(ship.size);
          const rows = new Set(cells.map((c) => c.row));
          const cols = new Set(cells.map((c) => c.col));
          expect(rows.size === 1 || cols.size === 1).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('property: a seeded game always terminates correctly', () => {
  it('ends in a win for exactly one side within 200 shots', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const state = playOut(seed, 'huntTarget');
        expect(state.phase.name).toBe('gameOver');
        expect(state.log.length).toBeLessThanOrEqual(MAX_SHOTS);
        checkInvariants(state);
      }),
      { numRuns: 50 },
    );
  });

  it('holds every invariant after every single move', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        playOut(seed, 'huntTarget', checkInvariants);
      }),
      { numRuns: 25 },
    );
  });

  it('never fires twice at the same cell on either board', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const fired = { player: new Set<string>(), ai: new Set<string>() };
        playOut(seed, 'huntTarget', (state) => {
          const last = state.log[state.log.length - 1];
          if (!last) return;
          const seen = fired[last.side];
          expect(seen.has(toKey(last.coord))).toBe(false);
          seen.add(toKey(last.coord));
        });
      }),
      { numRuns: 25 },
    );
  });

  it('replays identically from the same seed', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(playOut(seed, 'huntTarget')).toEqual(playOut(seed, 'huntTarget'));
      }),
      { numRuns: 20 },
    );
  });
});

describe('property: illegal actions cannot corrupt the game', () => {
  const anyCoord = fc.record({
    row: fc.integer({ min: -2, max: 11 }),
    col: fc.integer({ min: -2, max: 11 }),
  });

  const anyAction: fc.Arbitrary<Action> = fc.oneof(
    anyCoord.map((coord): Action => ({ type: 'playerFire', coord })),
    fc.constant<Action>({ type: 'aiFire' }),
    fc.constant<Action>({ type: 'startGame' }),
    fc.constant<Action>({ type: 'randomizePlacement' }),
    fc.constant<Action>({ type: 'resetPlacement' }),
    fc
      .record({
        kind: fc.constantFrom(...FLEET_SPEC.map((spec) => spec.kind)),
        origin: anyCoord,
        orientation: fc.constantFrom('horizontal' as const, 'vertical' as const),
      })
      .map((placement): Action => ({ type: 'placeShip', ...placement })),
    fc
      .constantFrom(...FLEET_SPEC.map((spec) => spec.kind))
      .map((kind): Action => ({ type: 'removeShip', kind })),
  );

  it('survives arbitrary action sequences with its invariants intact', () => {
    fc.assert(
      fc.property(seeds, fc.array(anyAction, { maxLength: 60 }), (seed, actions) => {
        let state = createGame(seed);
        for (const action of actions) {
          state = reduce(state, action);
          checkInvariants(state);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('leaves a finished game frozen except for a new game', () => {
    fc.assert(
      fc.property(seeds, fc.array(anyAction, { maxLength: 20 }), (seed, actions) => {
        const finished = playOut(seed, 'huntTarget');
        let state = finished;
        for (const action of actions) state = reduce(state, action);
        expect(state.phase).toEqual(finished.phase);
        expect(state.log).toEqual(finished.log);
        expect(state.human.shots).toEqual(finished.human.shots);
        expect(state.ai.shots).toEqual(finished.ai.shots);
      }),
      { numRuns: 20 },
    );
  });
});

describe('property: the AI plays better than chance', () => {
  /** Shots the given strategy needs to clear a whole fleet, on one seed. */
  function shotsToClear(seed: number, strategy: StrategyName): number {
    const [fleet] = randomFleet(createRng(seed));
    const remaining = new Set(fleetCells(fleet).map(toKey));
    const shots: Record<string, 'hit' | 'miss'> = {};
    let memory = emptyMemory;
    let rng = createRng(seed + 1);
    let count = 0;

    while (remaining.size > 0) {
      const [coord, next] = chooseShot(strategy, { shots }, memory, rng);
      rng = next;
      count += 1;
      const key = toKey(coord);
      const hit = remaining.delete(key);
      shots[key] = hit ? 'hit' : 'miss';
      const ship = fleet.find((candidate) =>
        shipCells(candidate).some((cell) => toKey(cell) === key),
      );
      const sunk =
        hit &&
        ship !== undefined &&
        shipCells(ship).every((cell) => shots[toKey(cell)] === 'hit');
      memory = rememberShot(
        memory,
        coord,
        hit
          ? sunk
            ? { type: 'sunk', ship: ship!.kind }
            : { type: 'hit', ship: ship!.kind }
          : { type: 'miss' },
        { shots },
      );
    }
    return count;
  }

  it('clears a fleet in far fewer shots than the random baseline', () => {
    const sample = Array.from({ length: 30 }, (_, i) => i * 7 + 1);
    const mean = (strategy: StrategyName) =>
      sample.reduce((total, seed) => total + shotsToClear(seed, strategy), 0) /
      sample.length;

    const hunt = mean('huntTarget');
    const random = mean('random');
    expect(hunt).toBeLessThan(random * 0.85);
    // Sanity bound: a competent hunt/target AI averages well under 70 shots.
    expect(hunt).toBeLessThan(70);
  });

  it('always finishes within the number of cells on the board', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(shotsToClear(seed, 'huntTarget')).toBeLessThanOrEqual(allCoords().length);
      }),
      { numRuns: 30 },
    );
  });
});

describe('property: the AI cannot see the fleet it is shooting at', () => {
  it('makes identical choices for identical shot histories, whatever the fleet is', () => {
    fc.assert(
      fc.property(seeds, seeds, (seed, otherSeed) => {
        const shots: Record<string, 'hit' | 'miss'> = {};
        const coords: Coord[] = [];
        let rng = createRng(seed);
        for (let i = 0; i < 20; i += 1) {
          const [coord, next] = chooseShot('huntTarget', { shots }, emptyMemory, rng);
          rng = next;
          coords.push(coord);
          shots[toKey(coord)] = 'miss';
        }
        // The same history replayed against a different hidden fleet must produce the
        // same sequence: the AI's only input is the view it is given.
        const replayShots: Record<string, 'hit' | 'miss'> = {};
        let replayRng = createRng(seed);
        randomFleet(createRng(otherSeed));
        for (const expected of coords) {
          const [coord, next] = chooseShot(
            'huntTarget',
            { shots: replayShots },
            emptyMemory,
            replayRng,
          );
          replayRng = next;
          expect(coord).toEqual(expected);
          replayShots[toKey(coord)] = 'miss';
        }
      }),
      { numRuns: 10 },
    );
  });
});
