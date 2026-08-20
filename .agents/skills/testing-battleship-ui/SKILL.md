---
name: testing-battleship-ui
description: How to run and browser-test the Battleship React/Vite app end to end (setup, seeds, coordinates, keyboard play, known layout pitfalls).
---

# Testing the Battleship UI

## Running the app

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"   # Node 22
cd /path/to/battleship && npm install && npm run dev  # http://localhost:5173
```

Use `?seed=<n>` for a reproducible enemy layout (e.g. `http://localhost:5173/?seed=42`).
Clicking "New game" increments the seed (42 -> 43), so a second game is a _different_
layout — reload the URL if you need the same one.

For `?seed=42` the enemy fleet is Carrier A7-E7, Battleship H2-H5, Cruiser G9-I9,
Submarine E3-E5, Destroyer E8-F8 (17 shots to win). Derive layouts for other seeds by
calling `createGame(seed)` from `src/core/game.ts` in a throwaway vitest file.

## Window / zoom

In a 1024x768 desktop the app does NOT fit at 100% browser zoom: the setup controls
(Rotate / Random layout / Clear board / Start game) fall below the fold. Set page zoom to
80-90% (`ctrl+minus`) before recording so the status panel, both boards and the setup
panel are visible at once. Flag this as a polish issue if the layout has not been tightened.

## Locating squares reliably

Every square is a `<button>` with an accessible name like `A1, water` / `B4, hit` /
`J10, sunk` / `C2, invalid placement` / `F1, placement preview`, so the annotated DOM is
the source of truth for assertions.

Screen coordinates drift: while the move log is short, each new log line pushes the boards
down (~11 screen px per line, ~22 px per player+AI round) — a click computed from an older
screenshot lands one row off. Once the log fills its container it becomes scrollable and
positions stabilise. Robust approach: before a click, read the target's rect and convert
CSS px to screenshot px, e.g. in the browser console

```js
const el = [
  ...document.querySelectorAll('section[aria-label="Enemy waters"] button'),
].find((b) => b.getAttribute('aria-label').startsWith('H2,'));
const r = el.getBoundingClientRect(); // screenX = r.x*scale, screenY = r.y*scale + chromeHeight
```

Calibrate `scale` and `chromeHeight` once from a known cell (scale = 1024/innerWidth).

## Keyboard-only play

Tab order inside the page is: New game -> own-board buttons (disabled boards are skipped)
-> enemy-board buttons in row-major order. After a shot the board is disabled during the
~650 ms AI delay, which drops focus to `<body>`; from there `Tab` x (2 + index) reaches
enemy cell `index = (row-1)*10 + col - 1`. Enter and Space both activate a square.

## Things worth asserting

- A placed ship must stay `your ship` while an invalid preview is shown elsewhere.
- A refused placement must keep the chosen ship selected (next legal click places the _same_
  ship). Regression risk lives in `place()` in `src/App.tsx`.
- "Clear board" after a full fleet must leave setup usable (next click places a Carrier).
- "New game" mid-play must clear the board/log and no delayed AI shot may land afterwards.
- Unhit enemy cells stay `water`; only hits/sunk are revealed.
- Repeat shot -> notice "You have already fired at X." and the turn stays with the player.
- Enemy board disabled during the AI turn and after game over.

## Devin secrets needed

None — no login, no backend, no secrets.
