import type { Action } from '../core/game';
import { FLEET_SPEC, isFleetComplete, unplacedKinds } from '../core/fleet';
import type { Fleet, Orientation, ShipKind } from '../core/types';

type SetupPanelProps = {
  readonly fleet: Fleet;
  readonly selected: ShipKind | undefined;
  readonly orientation: Orientation;
  readonly onSelect: (kind: ShipKind) => void;
  readonly dispatch: (action: Action) => void;
};

export function SetupPanel({
  fleet,
  selected,
  orientation,
  onSelect,
  dispatch,
}: SetupPanelProps) {
  const unplaced = new Set(unplacedKinds(fleet));
  const nextOrientation: Orientation =
    orientation === 'horizontal' ? 'vertical' : 'horizontal';

  return (
    <section className="panel" aria-label="Place your fleet">
      <h2>Place your fleet</h2>
      <p className="hint">
        Pick a ship, then click your board to place it. Ships may touch but not overlap.
      </p>

      <ul className="ships">
        {FLEET_SPEC.map((spec) => {
          const placed = !unplaced.has(spec.kind);
          return (
            <li key={spec.kind}>
              <button
                type="button"
                aria-pressed={selected === spec.kind}
                className={selected === spec.kind ? 'ship ship--selected' : 'ship'}
                onClick={() => onSelect(spec.kind)}
              >
                {spec.label} ({spec.size})
              </button>
              {placed && (
                <button
                  type="button"
                  className="link"
                  onClick={() => dispatch({ type: 'removeShip', kind: spec.kind })}
                >
                  Remove {spec.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <button
          type="button"
          onClick={() =>
            dispatch({ type: 'setPlacementOrientation', orientation: nextOrientation })
          }
        >
          Rotate to {nextOrientation}
        </button>
        <button type="button" onClick={() => dispatch({ type: 'randomizePlacement' })}>
          Random layout
        </button>
        <button type="button" onClick={() => dispatch({ type: 'resetPlacement' })}>
          Clear board
        </button>
        <button
          type="button"
          className="primary"
          disabled={!isFleetComplete(fleet)}
          onClick={() => dispatch({ type: 'startGame' })}
        >
          Start game
        </button>
      </div>
    </section>
  );
}
