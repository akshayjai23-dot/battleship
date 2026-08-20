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

## 3. A refused placement forgot which ship the player had picked

- **Symptom** — pick the Cruiser, click a square where it does not fit, read the "does not
  fit there" notice, then click a square where it does: the **Carrier** goes down instead
  of the Cruiser.
- **Root cause** — introduced by the fix for bug 2. `place()` cleared the player's explicit
  choice after every click, on the assumption that the click had succeeded. When the
  reducer refused the placement the fleet was unchanged, so the derived selection fell
  back to the first unplaced ship and quietly overrode the player.
- **Fix** — dropped the reset entirely. It was never needed: a ship that has just been
  placed leaves `unplacedKinds(fleet)`, so the derived selection advances on its own,
  and a refused placement now leaves the choice exactly where the player left it.
- **Regression test** — `src/App.test.tsx`, "keeps the chosen ship when the reducer
  refuses a placement", committed red before the fix.

Worth noting: this one was caused by the fix for bug 2, which is exactly why every entry
here names the test that now holds the behaviour in place.

## 4. Half the game was below the fold on a 1024x768 screen

- **Symptom** — found by playing the game in a real 1024x768 browser window at 100% zoom,
  not in the tests. During setup the "Start game" button sat at y≈958 in a 639px-tall
  viewport, so a first-time player saw a board and no way to begin. After the first
  attempt at a fix the button fitted but the boards did not: enemy rows 7–10 were off
  screen, so firing at half the grid meant scrolling the page first.
- **Root cause** — three separate causes with one theme, that the layout was only ever
  looked at on a large screen. The page was a single column, so the two 10x10 grids
  stacked to 797px on their own. The status panel rendered an empty fleet list and an
  empty move-log box throughout setup, when neither can say anything yet. And the square
  size was fixed against viewport _width_, when for a stacked pair of boards the binding
  constraint is viewport _height_.
- **Fix** — the boards and the panels became two columns; the fleet list and move log are
  rendered only once a game is in progress; and `--cell` now shrinks to `1.5rem` under
  `@media (max-height: 46rem)`, which also lets the two boards sit side by side. Measured
  at a 992x639 viewport: `scrollHeight` 639 == `clientHeight` 639, both boards and every
  control fully in view.
- **Regression test** — `e2e/smoke.spec.ts`, "fits a 1024x768 screen with every square
  reachable". jsdom has no layout engine, so this one had to be a real browser: the test
  loads the production build in a 992x639 viewport and asserts zero scroll overflow and
  zero of the 200 board squares outside the viewport. Reverting `--cell` to its old value
  makes it fail.

## 5. The boards jumped a row on every shot, and the move log renumbered itself

- **Symptom** — two smaller findings from the same play session. Each new log line grew
  the panel, which pushed the boards down, so the square under the cursor changed between
  one shot and the next. Separately, the log listed the newest move first but numbered
  the list from 1 downwards, so a given move was renumbered after every shot and "1"
  meant "most recent" rather than "first".
- **Root cause** — the log had no height of its own and simply grew with its contents.
  The numbering came free from `<ol>`, which counts from the top of a list that was being
  rendered in reverse.
- **Fix** — the log has a fixed `8rem` height and scrolls internally, so the layout is
  the same size whether it holds one entry or thirty; and the list uses
  `reversed start={log.length}`, which counts _down_ from the move count so the oldest
  entry keeps the number 1.
- **Regression test** — `src/App.test.tsx`, "shows the newest move first without
  renumbering the older ones". The fixed height is CSS, so it was verified in a real
  browser instead: the log stayed 128px and the enemy board's document position was
  unchanged before and after every shot.

## 6. Move 10 in the log displayed as "0"

- **Symptom** — found by smoke-testing the deployed site. Once the move log reached ten
  entries the newest line read "0. AI fired at J5 — hit." Every earlier move was numbered
  correctly, so the log appeared to restart at zero midway through a game.
- **Root cause** — the numbering was right and the markup said so (`<ol reversed
start="10">`); it was the rendering that was wrong. An `<ol>` draws its markers outside
  the list box, inside the left padding, and `.log` had `padding-left: 1.25rem` — 20px,
  narrower than the 22.9px "10." needs — so the leading digit was clipped. The bug could
  only appear after ten moves, which is why five sessions of manual play and a suite that
  fires at most four shots per test never saw it.
- **Fix** — `padding-left: 2.25rem`, wide enough for a three-digit marker (a game cannot
  exceed 200 moves).
- **Regression test** — `e2e/smoke.spec.ts`, "keeps two-digit move numbers legible". It
  plays five shots to produce a ten-entry log and asserts the list's left padding is at
  least as wide as its widest marker, measured in the log's own computed font. Restoring
  `1.25rem` makes it fail with "Expected: >= 22.885894775390625, Received: 20".
