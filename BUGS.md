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
