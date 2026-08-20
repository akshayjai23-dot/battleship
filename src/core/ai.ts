import { allCoords, isOnBoard, orthogonalNeighbours, toKey } from './coords';
import { pick, type Rng } from './rng';
import type { CellKey, Coord, ShotMark, ShotOutcome } from './types';

/**
 * Everything the AI is allowed to know: the results of its own shots, and nothing else.
 *
 * The AI cannot cheat because it is never handed the opponent's fleet — that is enforced
 * by this type rather than by discipline.
 */
export type OpponentView = { readonly shots: Readonly<Record<CellKey, ShotMark>> };

/** What the AI remembers between turns. */
export type AiMemory = { readonly targets: readonly Coord[] };

export type StrategyName = 'random' | 'huntTarget';

export const emptyMemory: AiMemory = { targets: [] };

function untriedCoords(view: OpponentView): Coord[] {
  return allCoords().filter((coord) => view.shots[toKey(coord)] === undefined);
}

function isUntried(view: OpponentView, coord: Coord): boolean {
  return isOnBoard(coord) && view.shots[toKey(coord)] === undefined;
}

/**
 * Cells worth hunting on: the smallest ship covers two cells, so it must touch a cell of
 * one parity, which halves the search space.
 *
 * The fallback matters — once every parity cell has been tried, the mask must be dropped
 * or the AI has nowhere left to shoot.
 */
function huntCandidates(view: OpponentView): Coord[] {
  const untried = untriedCoords(view);
  const parity = untried.filter((coord) => (coord.row + coord.col) % 2 === 0);
  return parity.length > 0 ? parity : untried;
}

/** The contiguous run of hits through `coord` along one axis. */
function hitRun(view: OpponentView, coord: Coord, axis: 'row' | 'col'): Coord[] {
  const step = axis === 'row' ? { row: 0, col: 1 } : { row: 1, col: 0 };
  const run = [coord];

  for (const direction of [-1, 1]) {
    let next = {
      row: coord.row + step.row * direction,
      col: coord.col + step.col * direction,
    };
    while (isOnBoard(next) && view.shots[toKey(next)] === 'hit') {
      run.push(next);
      next = {
        row: next.row + step.row * direction,
        col: next.col + step.col * direction,
      };
    }
  }
  return run.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** The two cells that would extend a run of hits at either end. */
function runExtensions(view: OpponentView, run: Coord[]): Coord[] {
  const first = run[0];
  const last = run[run.length - 1];
  if (!first || !last || run.length < 2) return [];
  const dRow = Math.sign(last.row - first.row);
  const dCol = Math.sign(last.col - first.col);
  return [
    { row: first.row - dRow, col: first.col - dCol },
    { row: last.row + dRow, col: last.col + dCol },
  ].filter((coord) => isUntried(view, coord));
}

/**
 * Folds a shot result into the AI's memory.
 *
 * `view` must already include the shot that was just fired.
 */
export function rememberShot(
  memory: AiMemory,
  coord: Coord,
  outcome: ShotOutcome,
  view: OpponentView,
): AiMemory {
  const stillUseful = memory.targets.filter((target) => isUntried(view, target));

  switch (outcome.type) {
    case 'sunk':
      // The ship is finished, and every queued cell was speculation about it. Ships may
      // touch, so this can discard a lead on a neighbouring ship; that costs a few extra
      // shots but never correctness, because hunting re-finds any ship still afloat.
      return emptyMemory;
    case 'hit': {
      const rowRun = hitRun(view, coord, 'row');
      const colRun = hitRun(view, coord, 'col');
      // Once two hits line up, the ship's axis is known: extend it instead of poking
      // at perpendicular neighbours.
      const alongAxis = [...runExtensions(view, rowRun), ...runExtensions(view, colRun)];
      const candidates =
        alongAxis.length > 0
          ? alongAxis
          : orthogonalNeighbours(coord).filter((n) => isUntried(view, n));
      return { targets: dedupe([...candidates, ...stillUseful]) };
    }
    case 'miss':
      return { targets: stillUseful };
    case 'rejected':
      return memory;
  }
}

function dedupe(coords: readonly Coord[]): Coord[] {
  const seen = new Set<CellKey>();
  return coords.filter((coord) => {
    const key = toKey(coord);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Chooses the AI's next shot. Never returns a cell it has already tried.
 *
 * Throws if the board is exhausted: that should be impossible while a ship is afloat,
 * and a loud failure beats an infinite loop.
 */
export function chooseShot(
  strategy: StrategyName,
  view: OpponentView,
  memory: AiMemory,
  rng: Rng,
): [coord: Coord, next: Rng] {
  const untried = untriedCoords(view);
  if (untried.length === 0) throw new Error('The AI has no cells left to fire at');

  if (strategy === 'huntTarget') {
    const target = memory.targets.find((candidate) => isUntried(view, candidate));
    if (target) return [target, rng];
    return pick(rng, huntCandidates(view));
  }
  return pick(rng, untried);
}
