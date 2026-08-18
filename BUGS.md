# Bug log

Every bug found in this project is recorded here **as it is found**, not reconstructed at
the end. Each entry follows the same format:

- **Symptom** — what was observed.
- **Root cause** — why it actually happened.
- **Fix** — what changed.
- **Regression test** — the test that now fails if the bug comes back.

Two rules keep this document honest:

1. For every genuine bug, the failing test is committed **before** the fix, so the git
   history shows red-then-green.
2. Unfinished features are not bugs. Only defects in code that was believed complete are
   recorded here.

---

## 1. Placing a ship made it disappear under the next ship's preview

- **Symptom** — during setup, clicking to place the Carrier at A1 left A1–D1 rendered as
  an orange "invalid placement" overlay instead of as the ship. Only E1, the one square
  the next ship's preview did not cover, looked like a ship. To the player, four fifths
  of the ship they had just placed had vanished.
- **Root cause** — after a placement the selection advances to the next ship, but the
  cursor has not moved, so a preview for that next ship is immediately drawn at the same
  origin. In `ownCells` the preview was resolved _before_ the ship, so preview squares
  won over real ones. The overlay was flagged invalid, correctly, because the next ship
  would have overlapped the one just placed — but it hid the placed ship to say so.
- **Fix** — reordered the cell-state precedence in `ownCells` to damage → own ship →
  preview → water, so a preview can only ever paint over open water. The illegality is
  still visible on the preview squares that fall outside the placed ship.
- **Regression test** — `src/ui/cells.test.ts`, "never lets a preview hide a ship that
  is already placed". Committed red in `c1a9a75`, fixed in the commit that follows it.

## 2. Setup went dead after the fleet was placed and then cleared

- **Symptom** — place all five ships by hand, press "Clear board", then click the grid:
  nothing happens. No ship appears, no message explains why. The same happened after
  "New game" from a finished setup, and a click straight after "Random layout" reported
  "the Carrier is already on the board" instead of placing anything.
- **Root cause** — the ship being placed was React component state that auto-advanced
  after each placement, and became `undefined` once the fifth ship was placed. The
  reducer actions that empty or replace the fleet — `resetPlacement`, `newGame`,
  `randomizePlacement`, `removeShip` — knew nothing about that component state, so it
  was left pointing at nothing (or at a ship already on the board) while the board it
  described had changed underneath it. Two sources of truth for the same fact.
- **Fix** — the selection is now derived from the fleet rather than stored: the player's
  explicit choice is honoured only while that ship is still unplaced, and otherwise
  falls back to `unplacedKinds(fleet)[0]`. Any reducer action that changes the fleet
  self-corrects the UI, because there is no longer a second copy to fall out of step.
- **Regression test** — `src/App.test.tsx`, "still accepts placements after the board is
  cleared" and "starts placing the removed ship again after it is taken off the board".
  Both committed red before the fix.
