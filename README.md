# Battleship

A browser Battleship game against an AI opponent.

- **Play:** https://battleship-five-chi.vercel.app/ (serves the real game once PRs 1-4 are
  merged to `main`)
- **Bug log:** [BUGS.md](./BUGS.md)

## How to play

Pick a ship, click your own grid to drop it, and use **Rotate** to switch between
horizontal and vertical — or press **Random layout** and skip the whole thing. The preview
under the cursor is green where the ship fits and orange where it does not. Once all five
ships are down, **Start game** fires. You shoot first; the AI replies after a short pause.
Enemy ships stay hidden until you hit them, and a sunk ship reveals its whole hull.

Everything works with the keyboard alone: every square is a button, so Tab moves between
them and Enter or Space places a ship or takes a shot.

## Running locally

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit + property tests (watch mode)
npm run test:coverage
npm run typecheck
npm run lint

npx playwright install chromium
npm run test:e2e   # smoke test against the production build
```

Node 22 is required (`.nvmrc`); Vite 8's native binaries are skipped on older versions,
which makes the test run silently misbehave rather than fail loudly.

## Architecture

The project is deliberately split into a pure rules engine and a thin UI:

```
src/
  core/   framework-free TypeScript: the rules, the state machine, the AI. No React,
          no DOM, no Math.random, no clock. This is where correctness lives.
  ui/     React components. Rendering and input only — no game rules.
  test/   shared test setup and fixtures.
```

The dependency direction is one-way: `ui` may import from `core`, never the reverse.
This is enforced by a test (`src/core/purity.test.ts`) rather than by convention, so a
violation fails CI.

### Design decisions and trade-offs

**All game logic runs in the browser; there is no server.** This is a single-player game
against an AI, so there is no adversary to cheat against — the cost of a determined
player inspecting the AI's board is nil, while a server would add session state, network
failure modes, and a class of bugs unrelated to the actual exercise. The rules engine is
a pure module with no React or DOM dependency, so moving it behind an HTTP handler would
not require changing it.

**All randomness comes from a seeded PRNG injected as a dependency.** Ship placement and
AI moves are reproducible from a seed shown in the UI and settable via `?seed=`, which
means any bug can be replayed exactly and no test is flaky.

**The fleet is the source of truth; the grid is derived.** Ships own their own hits and
`isSunk` is computed, never stored, so the rendered board and the fleet cannot disagree.

**Game phase is a discriminated union, not a set of booleans.** Illegal states such as
"game over but still the player's turn" are unrepresentable.

**Every rule guard lives in the reducer, not in components.** Disabled buttons are
cosmetic; the reducer independently rejects duplicate shots, out-of-turn shots, and any
action after the game ends.

## Testing

- Unit tests over `core/`, including a rejection test for every illegal action.
- Property-based tests (fast-check) that play thousands of seeded AI-vs-AI games and
  assert the game's invariants after every single move.
- Component tests (React Testing Library) for interaction and accessibility.
- One end-to-end smoke test (Playwright) against the production build: it plays a turn
  and asserts the whole game fits a 1024x768 screen, which is the one thing jsdom cannot
  check because it has no layout engine.

All of it runs in CI on every push.

## Status

| PR  | Scope                                            | State     |
| --- | ------------------------------------------------ | --------- |
| 1   | Scaffold, CI, docs, rules primitives             | in review |
| 2   | State machine, AI, property tests                | in review |
| 3   | UI + play loop + accessibility                   | in review |
| 4   | Production smoke test, hardening, final bug pass | in review |

Each PR is stacked on the one before it, so they merge bottom-up.
