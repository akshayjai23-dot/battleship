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

"Fits on one screen" claims are about viewport **height**, not width — measure, never infer.
A 1024x768 Chrome window only gives ~992x639 CSS px of viewport (browser chrome eats ~130 px),
and the setup-phase page has historically been ~1060 px tall (boards ~350 px, but the sidebar
stacks the status panel ~390 px on top of the setup panel ~530 px), so
Rotate / Random layout / Clear board / **Start game** can still fall below the fold at 100% zoom
even after a "sidebar" layout change. It may look fine on a maximised large virtual display
(e.g. 1600x1069) — always re-test in a real 1024x768 window.

Objective check to run in the console before claiming a pass:

```js
const se = document.scrollingElement;
const start = [...document.querySelectorAll('button')].find(
  (b) => b.textContent.trim() === 'Start game',
);
({
  innerW: innerWidth,
  innerH: innerHeight,
  scrollH: se.scrollHeight,
  clientH: se.clientHeight,
  startBottom: Math.round(start.getBoundingClientRect().bottom),
});
```

Pass = `scrollH <= clientH` and `startBottom <= innerHeight`. The stripped DOM also marks
out-of-view elements with `offscreen=""`, which is a quick corroborating signal.

Controls fitting is NOT the same as the game being playable: also count how many _board rows_
are above the fold, because the two 10x10 grids stack vertically on the left at ~992 px CSS
width (~349 px each + headings => the enemy board can end near y=797). Quantify it with:

```js
const H = innerHeight;
const cells = [...document.querySelectorAll('section[aria-label="Enemy waters"] button')];
const r = (b) => b.getBoundingClientRect();
({
  full: cells.filter((b) => r(b).bottom <= H).length,
  partial: cells.filter((b) => r(b).top < H && r(b).bottom > H).length,
  off: cells.filter((b) => r(b).top >= H).length,
});
```

If rows 6-10 are off-screen the player must scroll to fire at them — report that as a failure
of "fits on one screen" even when Start game is above the fold.
Workaround for gameplay testing if it does not fit: page zoom 80-90% (`ctrl+minus`), or
maximise on a taller virtual display; mid-game (setup panel gone) usually fits at 1024x768.
Resize precisely with `wmctrl -r :ACTIVE: -b remove,maximized_vert,maximized_horz` then
`wmctrl -r :ACTIVE: -e 0,0,0,1024,768`.

`src/index.css` carries a height breakpoint `@media (max-height: 46rem) { --cell: <1.25-1.5>rem }`
(currently 1.5rem), so squares are 20-24 px (instead of 32 px) on short windows and the two grids then sit side by
side instead of stacking. Always verify which branch is active before trusting coordinates:
`getComputedStyle(document.documentElement).getPropertyValue('--cell')`. 20 px squares are
still reliably clickable with xdotool as long as you click cell centres computed from
`getBoundingClientRect()`.

The virtual display itself may be only 1024x768, so "maximise" does not give a wider window.
Change the X resolution first: `xrandr -s 1600x1200` (list modes with `xrandr`), test, then
`xrandr -s 1024x768` to restore.

## Locating squares reliably

Every square is a `<button>` with an accessible name like `A1, water` / `B4, hit` /
`J10, sunk` / `C2, invalid placement` / `F1, placement preview`, so the annotated DOM is
the source of truth for assertions.

Screen coordinates can drift as the game state changes (the move log used to push the boards
down ~11 screen px per line before it was given a fixed `height: 8rem`; removing the setup
panel at "Start game" also re-centres the boards horizontally). Never reuse click coordinates
across a phase change — re-measure. To check for drift, record one cell's rect (e.g. J10)
before and after each shot and assert it is unchanged. Caveat: `getBoundingClientRect()` is
viewport-relative, and Tab-focusing a partly-hidden square scrolls the page, so compare
`rect.y + window.scrollY` (document coordinates) or a page-scroll will look like layout drift. Robust approach: before a click, read the target's rect and convert
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

## Synthetic-click pitfall

xdotool clicks issued immediately after another click (e.g. clicking "New game" ~0.1-0.45 s
after firing a shot, i.e. during the ~650 ms AI delay) can be silently dropped: the button is
not disabled and `pointer-events` is `auto`, and the same action works via `button.click()` in
the console or via a click with a longer hover before it. If a UI click seems ignored, move the
mouse, wait ~0.4-0.6 s, then click, and cross-check with a JS `.click()` before reporting an
app bug.

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
