import { describe, expect, it } from 'vitest';
import {
  chooseShot,
  emptyMemory,
  rememberShot,
  type AiMemory,
  type OpponentView,
} from './ai';
import { allCoords, parseCoord, toKey } from './coords';
import { createRng } from './rng';
import type { Coord, ShotMark } from './types';

/** Builds a view from display notation, e.g. `view({ E5: 'hit', E6: 'miss' })`. */
function view(marks: Record<string, ShotMark>): OpponentView {
  const shots: Record<string, ShotMark> = {};
  for (const [label, mark] of Object.entries(marks)) {
    const coord = parseCoord(label);
    if (!coord) throw new Error(`bad test coordinate ${label}`);
    shots[toKey(coord)] = mark;
  }
  return { shots };
}

function at(label: string): Coord {
  const coord = parseCoord(label);
  if (!coord) throw new Error(`bad test coordinate ${label}`);
  return coord;
}

function labelsOf(memory: AiMemory): string[] {
  return memory.targets.map((coord) => `${coord.row},${coord.col}`).sort();
}

function keysOf(coords: readonly Coord[]): string[] {
  return coords.map(toKey).sort();
}

describe('chooseShot — random strategy', () => {
  it('only ever picks a cell that has not been tried', () => {
    let rng = createRng(1);
    const shots: Record<string, ShotMark> = {};
    for (let i = 0; i < 100; i += 1) {
      const [coord, next] = chooseShot('random', { shots }, emptyMemory, rng);
      expect(shots[toKey(coord)]).toBeUndefined();
      shots[toKey(coord)] = 'miss';
      rng = next;
    }
    expect(Object.keys(shots)).toHaveLength(100);
  });

  it('throws rather than looping when the board is exhausted', () => {
    const shots = Object.fromEntries(
      allCoords().map((coord) => [toKey(coord), 'miss' as ShotMark]),
    );
    expect(() => chooseShot('random', { shots }, emptyMemory, createRng(1))).toThrow(
      /no cells left/i,
    );
  });

  it('is deterministic for a given seed', () => {
    const a = chooseShot('random', { shots: {} }, emptyMemory, createRng(9));
    const b = chooseShot('random', { shots: {} }, emptyMemory, createRng(9));
    expect(a[0]).toEqual(b[0]);
  });
});

describe('chooseShot — hunt phase', () => {
  it('hunts only on the parity that every ship must touch', () => {
    let rng = createRng(5);
    for (let i = 0; i < 50; i += 1) {
      const [coord, next] = chooseShot('huntTarget', { shots: {} }, emptyMemory, rng);
      expect((coord.row + coord.col) % 2).toBe(0);
      rng = next;
    }
  });

  it('falls back to the other parity once its own is exhausted', () => {
    const shots: Record<string, ShotMark> = {};
    for (const coord of allCoords()) {
      if ((coord.row + coord.col) % 2 === 0) shots[toKey(coord)] = 'miss';
    }
    const [coord] = chooseShot('huntTarget', { shots }, emptyMemory, createRng(3));
    expect((coord.row + coord.col) % 2).toBe(1);
    expect(shots[toKey(coord)]).toBeUndefined();
  });

  it('ignores a queued target that has already been fired at', () => {
    const memory: AiMemory = { targets: [at('E5'), at('E6')] };
    const [coord] = chooseShot('huntTarget', view({ E5: 'miss' }), memory, createRng(2));
    expect(coord).toEqual(at('E6'));
  });
});

describe('rememberShot — target phase', () => {
  it('queues the four neighbours of a first hit', () => {
    const memory = rememberShot(
      emptyMemory,
      at('E5'),
      { type: 'hit', ship: 'cruiser' },
      view({ E5: 'hit' }),
    );
    expect(keysOf(memory.targets)).toEqual(
      keysOf([at('D5'), at('F5'), at('E4'), at('E6')]),
    );
  });

  it('queues only on-board neighbours at a corner', () => {
    const memory = rememberShot(
      emptyMemory,
      at('A1'),
      { type: 'hit', ship: 'destroyer' },
      view({ A1: 'hit' }),
    );
    expect(keysOf(memory.targets)).toEqual(keysOf([at('B1'), at('A2')]));
  });

  it('fires at a queued neighbour before resuming the hunt', () => {
    const memory = rememberShot(
      emptyMemory,
      at('E5'),
      { type: 'hit', ship: 'cruiser' },
      view({ E5: 'hit' }),
    );
    const [coord] = chooseShot('huntTarget', view({ E5: 'hit' }), memory, createRng(4));
    expect(memory.targets.map(toKey)).toContain(toKey(coord));
  });

  it('switches to extending the run once two hits line up', () => {
    const board = view({ E5: 'hit', E6: 'hit' });
    const memory = rememberShot(
      { targets: [at('D5'), at('F5'), at('E4')] },
      at('E6'),
      { type: 'hit', ship: 'cruiser' },
      board,
    );
    // The ends of the run come first, ahead of the stale perpendicular guesses.
    expect(keysOf(memory.targets.slice(0, 2))).toEqual(keysOf([at('E4'), at('E7')]));
  });

  it('extends a vertical run along the column', () => {
    const board = view({ E5: 'hit', F5: 'hit' });
    const memory = rememberShot(
      emptyMemory,
      at('F5'),
      { type: 'hit', ship: 'cruiser' },
      board,
    );
    expect(keysOf(memory.targets)).toEqual(keysOf([at('D5'), at('G5')]));
  });

  it('extends a run that reaches the board edge in one direction only', () => {
    const board = view({ A1: 'hit', A2: 'hit' });
    const memory = rememberShot(
      emptyMemory,
      at('A2'),
      { type: 'hit', ship: 'cruiser' },
      board,
    );
    expect(keysOf(memory.targets)).toEqual(keysOf([at('A3')]));
  });

  it('keeps unresolved targets after a miss', () => {
    const memory = rememberShot(
      { targets: [at('D5'), at('F5')] },
      at('E4'),
      { type: 'miss' },
      view({ E5: 'hit', E4: 'miss' }),
    );
    expect(keysOf(memory.targets)).toEqual(keysOf([at('D5'), at('F5')]));
  });

  it('drops targets that have since been fired at', () => {
    const memory = rememberShot(
      { targets: [at('D5'), at('F5')] },
      at('D5'),
      { type: 'miss' },
      view({ D5: 'miss', F5: 'miss' }),
    );
    expect(memory.targets).toEqual([]);
  });

  it('clears the queue when a ship is sunk', () => {
    const memory = rememberShot(
      { targets: [at('D5'), at('F5')] },
      at('E6'),
      { type: 'sunk', ship: 'destroyer' },
      view({ E5: 'hit', E6: 'hit' }),
    );
    expect(memory).toEqual(emptyMemory);
  });

  it('never queues a cell that has already been shot at', () => {
    const memory = rememberShot(
      emptyMemory,
      at('E5'),
      { type: 'hit', ship: 'cruiser' },
      view({ E5: 'hit', D5: 'miss', E4: 'miss' }),
    );
    expect(keysOf(memory.targets)).toEqual(keysOf([at('F5'), at('E6')]));
  });

  it('never queues the same cell twice', () => {
    const memory = rememberShot(
      { targets: [at('E4'), at('E7')] },
      at('E6'),
      { type: 'hit', ship: 'cruiser' },
      view({ E5: 'hit', E6: 'hit' }),
    );
    expect(labelsOf(memory)).toEqual([...new Set(labelsOf(memory))]);
  });

  it('leaves memory untouched for a rejected shot', () => {
    const memory: AiMemory = { targets: [at('D5')] };
    expect(
      rememberShot(
        memory,
        at('E5'),
        { type: 'rejected', reason: 'already-targeted' },
        view({}),
      ),
    ).toBe(memory);
  });
});
