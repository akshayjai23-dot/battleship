import { useState } from 'react';
import { shipCells, placementError } from './core/board';
import { specFor, unplacedKinds } from './core/fleet';
import type { Coord, ShipKind } from './core/types';
import { Board } from './ui/Board';
import { SetupPanel } from './ui/SetupPanel';
import { StatusPanel } from './ui/StatusPanel';
import { enemyCells, ownCells, type Preview } from './ui/cells';
import { useGame } from './ui/useGame';

/** Seeds come from `?seed=` when present, so any game can be replayed exactly. */
export function seedFromLocation(search: string): number {
  const raw = new URLSearchParams(search).get('seed');
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : Math.floor(Date.now() % 2 ** 31);
}

export default function App({ initialSeed }: { readonly initialSeed?: number }) {
  const [seed] = useState(() => initialSeed ?? seedFromLocation(window.location.search));
  const [state, dispatch] = useGame(seed);
  const [chosen, setChosen] = useState<ShipKind | undefined>(undefined);
  const [hovered, setHovered] = useState<Coord | undefined>(undefined);

  const setup = state.phase.name === 'setup';
  // The ship being placed is derived from the fleet rather than held in state: the
  // player's choice is honoured only while that ship is still unplaced, and otherwise
  // falls back to the next one. Clearing, randomising or restarting therefore cannot
  // strand the board with a selection that no longer means anything.
  const unplaced = unplacedKinds(state.human.fleet);
  const selected =
    chosen !== undefined && unplaced.includes(chosen) ? chosen : unplaced[0];
  const preview = setup ? previewFor(state, selected, hovered) : undefined;

  function place(origin: Coord) {
    if (!selected) return;
    dispatch({
      type: 'placeShip',
      kind: selected,
      origin,
      orientation: state.placementOrientation,
    });
  }

  return (
    <main>
      <header>
        <h1>Battleship</h1>
        <button type="button" onClick={() => dispatch({ type: 'newGame' })}>
          New game
        </button>
      </header>

      <StatusPanel state={state} />

      <div className="boards">
        <Board
          title="Your waters"
          cells={ownCells(state.human, preview)}
          disabled={!setup}
          onSelect={place}
          onHover={setHovered}
        />
        <Board
          title="Enemy waters"
          cells={enemyCells(state.ai)}
          // Guarded again in the reducer; disabling here is only to stop the pointer
          // inviting a click that would be rejected anyway.
          disabled={state.phase.name !== 'playerTurn'}
          onSelect={(coord) => dispatch({ type: 'playerFire', coord })}
        />
      </div>

      {setup && (
        <SetupPanel
          fleet={state.human.fleet}
          selected={selected}
          orientation={state.placementOrientation}
          onSelect={setChosen}
          dispatch={dispatch}
        />
      )}

      <footer>Seed {state.seed}</footer>
    </main>
  );
}

/** The squares a placement would occupy, and whether the rules would allow it. */
function previewFor(
  state: ReturnType<typeof useGame>[0],
  selected: ShipKind | undefined,
  hovered: Coord | undefined,
): Preview | undefined {
  if (!selected || !hovered) return undefined;
  const orientation = state.placementOrientation;
  const cells = shipCells({
    origin: hovered,
    orientation,
    size: specFor(selected).size,
  });
  const legal =
    placementError(state.human.fleet, selected, hovered, orientation) === undefined;
  return { cells, legal };
}
