import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../test/invariants';
import { placeShip, randomFleet, shipCells } from './board';
import { toKey } from './coords';
import { FLEET_SPEC, isFleetComplete } from './fleet';
import { createGame, reduce, type Action, type GameState } from './game';
import { createRng } from './rng';
import type { Coord, ShipKind } from './types';

const SEED = 2024;

function gameInSetup(): GameState {
  return createGame(SEED);
}

/** A game in progress with both fleets placed. */
function gameInPlay(seed = SEED): GameState {
  const [fleet] = randomFleet(createRng(seed + 1));
  const state = { ...createGame(seed), human: { fleet, shots: {} } };
  return reduce(state, { type: 'startGame' });
}

function firstShipCell(state: GameState, side: 'human' | 'ai'): Coord {
  return shipCells(state[side].fleet[0]!)[0]!;
}

function emptyWaterCell(state: GameState, side: 'human' | 'ai'): Coord {
  const occupied = new Set(state[side].fleet.flatMap(shipCells).map(toKey));
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (!occupied.has(toKey({ row, col }))) return { row, col };
    }
  }
  throw new Error('no empty water');
}

describe('createGame', () => {
  it('starts in setup with an AI fleet placed and no human ships', () => {
    const state = gameInSetup();
    expect(state.phase).toEqual({ name: 'setup' });
    expect(isFleetComplete(state.ai.fleet)).toBe(true);
    expect(state.human.fleet).toEqual([]);
    expect(state.log).toEqual([]);
    checkInvariants(state);
  });

  it('is fully determined by its seed', () => {
    expect(createGame(7)).toEqual(createGame(7));
    expect(createGame(7).ai.fleet).not.toEqual(createGame(8).ai.fleet);
  });
});

describe('placement', () => {
  it('places a ship and reports no notice', () => {
    const state = reduce(gameInSetup(), {
      type: 'placeShip',
      kind: 'cruiser',
      origin: { row: 0, col: 0 },
      orientation: 'horizontal',
    });
    expect(state.human.fleet.map((s) => s.kind)).toEqual(['cruiser']);
    expect(state.notice).toBeUndefined();
  });

  it.each([
    [
      'off the board',
      { kind: 'carrier', origin: { row: 0, col: 8 }, orientation: 'horizontal' },
      /does not fit/i,
    ],
    [
      'overlapping',
      { kind: 'destroyer', origin: { row: 0, col: 0 }, orientation: 'horizontal' },
      /overlap/i,
    ],
    [
      'already placed',
      { kind: 'cruiser', origin: { row: 5, col: 5 }, orientation: 'horizontal' },
      /already on the board/i,
    ],
  ])('explains a placement %s and changes nothing else', (_label, placement, message) => {
    const base = reduce(gameInSetup(), {
      type: 'placeShip',
      kind: 'cruiser',
      origin: { row: 0, col: 0 },
      orientation: 'horizontal',
    });
    const next = reduce(base, { type: 'placeShip', ...placement } as Action);
    expect(next.notice).toMatch(message);
    expect(next.human.fleet).toEqual(base.human.fleet);
  });

  it('removes a placed ship', () => {
    let state = reduce(gameInSetup(), {
      type: 'placeShip',
      kind: 'cruiser',
      origin: { row: 0, col: 0 },
      orientation: 'horizontal',
    });
    state = reduce(state, { type: 'removeShip', kind: 'cruiser' });
    expect(state.human.fleet).toEqual([]);
  });

  it('randomizes into a complete legal fleet and can be repeated', () => {
    let state = reduce(gameInSetup(), { type: 'randomizePlacement' });
    expect(isFleetComplete(state.human.fleet)).toBe(true);
    const first = state.human.fleet;
    state = reduce(state, { type: 'randomizePlacement' });
    expect(state.human.fleet).not.toEqual(first);
    checkInvariants(state);
  });

  it('resets placement back to an empty board', () => {
    let state = reduce(gameInSetup(), { type: 'randomizePlacement' });
    state = reduce(state, { type: 'resetPlacement' });
    expect(state.human.fleet).toEqual([]);
  });

  it('remembers the orientation for the next placement', () => {
    const state = reduce(gameInSetup(), {
      type: 'setPlacementOrientation',
      orientation: 'vertical',
    });
    expect(state.placementOrientation).toBe('vertical');
  });
});

describe('startGame', () => {
  it('refuses to start with an incomplete fleet', () => {
    const state = reduce(gameInSetup(), { type: 'startGame' });
    expect(state.phase).toEqual({ name: 'setup' });
    expect(state.notice).toMatch(/place all five ships/i);
  });

  it('starts once every ship is placed, with the player to move', () => {
    let state = reduce(gameInSetup(), { type: 'randomizePlacement' });
    state = reduce(state, { type: 'startGame' });
    expect(state.phase).toEqual({ name: 'playerTurn' });
  });
});

describe('playerFire', () => {
  it('records a miss and hands the turn to the AI', () => {
    const state = gameInPlay();
    const coord = emptyWaterCell(state, 'ai');
    const next = reduce(state, { type: 'playerFire', coord });
    expect(next.ai.shots[toKey(coord)]).toBe('miss');
    expect(next.phase).toEqual({ name: 'aiTurn' });
    expect(next.log).toHaveLength(1);
    expect(next.turn).toBe(1);
  });

  it('records a hit', () => {
    const state = gameInPlay();
    const coord = firstShipCell(state, 'ai');
    const next = reduce(state, { type: 'playerFire', coord });
    expect(next.ai.shots[toKey(coord)]).toBe('hit');
    expect(next.log[0]?.outcome.type).toBe('hit');
  });

  it('rejects a repeated shot without consuming the turn', () => {
    const state = gameInPlay();
    const coord = emptyWaterCell(state, 'ai');
    const afterFirst = reduce(state, { type: 'playerFire', coord });
    const backToPlayer = reduce(afterFirst, { type: 'aiFire' });
    const afterSecond = reduce(backToPlayer, { type: 'playerFire', coord });

    expect(afterSecond.notice).toMatch(/already fired/i);
    expect(afterSecond.phase).toEqual({ name: 'playerTurn' });
    expect(afterSecond.turn).toBe(backToPlayer.turn);
    expect(afterSecond.log).toEqual(backToPlayer.log);
  });

  it('rejects an off-board shot', () => {
    const state = gameInPlay();
    const next = reduce(state, { type: 'playerFire', coord: { row: -1, col: 0 } });
    expect(next.notice).toMatch(/off the board/i);
    expect(next.phase).toEqual({ name: 'playerTurn' });
  });

  it('is ignored during the AI turn', () => {
    const state = gameInPlay();
    const afterPlayer = reduce(state, {
      type: 'playerFire',
      coord: emptyWaterCell(state, 'ai'),
    });
    const next = reduce(afterPlayer, {
      type: 'playerFire',
      coord: { row: 9, col: 9 },
    });
    expect(next).toBe(afterPlayer);
  });

  it('is ignored during setup', () => {
    const state = gameInSetup();
    expect(reduce(state, { type: 'playerFire', coord: { row: 0, col: 0 } })).toBe(state);
  });
});

describe('aiFire', () => {
  it('fires exactly one shot and hands the turn back', () => {
    const state = reduce(gameInPlay(), {
      type: 'playerFire',
      coord: { row: 0, col: 0 },
    });
    const next = reduce(state, { type: 'aiFire' });
    expect(Object.keys(next.human.shots)).toHaveLength(1);
    expect(next.phase).toEqual({ name: 'playerTurn' });
  });

  it('is a no-op when dispatched twice, so a stale timer cannot double-move', () => {
    const state = reduce(gameInPlay(), {
      type: 'playerFire',
      coord: { row: 0, col: 0 },
    });
    const once = reduce(state, { type: 'aiFire' });
    const twice = reduce(once, { type: 'aiFire' });
    expect(twice).toBe(once);
    expect(Object.keys(twice.human.shots)).toHaveLength(1);
  });

  it('is ignored during the player turn and during setup', () => {
    const playing = gameInPlay();
    expect(reduce(playing, { type: 'aiFire' })).toBe(playing);
    const setup = gameInSetup();
    expect(reduce(setup, { type: 'aiFire' })).toBe(setup);
  });

  it('never fires at the same cell twice over a whole game', () => {
    let state = gameInPlay(31);
    const fired: string[] = [];
    while (state.phase.name !== 'gameOver') {
      if (state.phase.name === 'playerTurn') {
        const target = Object.keys(state.ai.shots).length;
        state = reduce(state, {
          type: 'playerFire',
          coord: { row: Math.floor(target / 10), col: target % 10 },
        });
      } else {
        state = reduce(state, { type: 'aiFire' });
        const last = state.log[state.log.length - 1]!;
        fired.push(toKey(last.coord));
      }
    }
    expect(new Set(fired).size).toBe(fired.length);
  });
});

describe('game over', () => {
  /** Sinks the AI fleet as fast as the rules allow, one player shot per turn. */
  function playerWins(seed = SEED): GameState {
    let state = gameInPlay(seed);
    const targets = state.ai.fleet.flatMap(shipCells);
    for (const coord of targets) {
      if (state.phase.name === 'gameOver') break;
      state = reduce(state, { type: 'playerFire', coord });
      if (state.phase.name === 'aiTurn') state = reduce(state, { type: 'aiFire' });
    }
    return state;
  }

  it('declares the player the winner on the sinking shot', () => {
    const state = playerWins();
    expect(state.phase).toEqual({ name: 'gameOver', winner: 'player' });
  });

  it('does not let the AI reply after losing', () => {
    const state = playerWins();
    const shotsBefore = Object.keys(state.human.shots).length;
    const next = reduce(state, { type: 'aiFire' });
    expect(next).toBe(state);
    expect(Object.keys(next.human.shots)).toHaveLength(shotsBefore);
  });

  it('ignores further player shots once the game is over', () => {
    const state = playerWins();
    expect(reduce(state, { type: 'playerFire', coord: { row: 0, col: 0 } })).toBe(state);
  });

  it('can be left only by starting a new game', () => {
    const state = playerWins();
    const next = reduce(state, { type: 'newGame' });
    expect(next.phase).toEqual({ name: 'setup' });
    expect(next.log).toEqual([]);
    expect(next.seed).not.toBe(state.seed);
  });

  it('starts a new game on a requested seed', () => {
    expect(reduce(gameInPlay(), { type: 'newGame', seed: 123 })).toEqual(createGame(123));
  });
});

describe('immutability', () => {
  it('never mutates the state it is given', () => {
    const state = gameInPlay();
    const snapshot = structuredClone(state);
    reduce(state, { type: 'playerFire', coord: { row: 0, col: 0 } });
    reduce(state, { type: 'newGame' });
    expect(state).toEqual(snapshot);
  });

  it('keeps a full fleet for both sides throughout', () => {
    let state = gameInPlay();
    for (let i = 0; i < 20; i += 1) {
      state = reduce(state, {
        type: state.phase.name === 'aiTurn' ? 'aiFire' : 'playerFire',
        coord: { row: Math.floor(i / 10), col: i % 10 },
      } as Action);
      expect(state.human.fleet).toHaveLength(FLEET_SPEC.length);
      expect(state.ai.fleet).toHaveLength(FLEET_SPEC.length);
      checkInvariants(state);
    }
  });
});

describe('unknown ship kinds', () => {
  it('rejects a placement of a kind that does not exist', () => {
    expect(() =>
      reduce(gameInSetup(), {
        type: 'placeShip',
        kind: 'dinghy' as ShipKind,
        origin: { row: 0, col: 0 },
        orientation: 'horizontal',
      }),
    ).toThrow();
  });

  it('still allows placing beside an existing ship', () => {
    let state = gameInSetup();
    state = {
      ...state,
      human: {
        ...state.human,
        fleet: placeShip([], 'cruiser', { row: 0, col: 0 }, 'horizontal'),
      },
    };
    const next = reduce(state, {
      type: 'placeShip',
      kind: 'destroyer',
      origin: { row: 1, col: 0 },
      orientation: 'horizontal',
    });
    expect(next.human.fleet).toHaveLength(2);
  });
});
