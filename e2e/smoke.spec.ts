import { expect, test } from '@playwright/test';

// One smoke test against the production build. Everything about the rules is already
// covered by unit and property tests; this only asks whether the built app boots, plays
// a turn, and fits the smallest supported screen — none of which jsdom can answer.
test.describe('production build', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?seed=42');
  });

  test('plays a turn and gets a reply from the AI', async ({ page }) => {
    await expect(page.getByRole('status')).toHaveText('Place your fleet to begin.');

    await page.getByRole('button', { name: 'Random layout' }).click();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByRole('status')).toContainText('Your turn');

    const enemy = page.getByRole('region', { name: 'Enemy waters' });
    await enemy.getByRole('button', { name: 'A1, water' }).click();

    // The AI answers on a timer, so the log reaching two entries is the real assertion.
    const log = page.getByRole('list', { name: 'Move log' });
    await expect(log.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('status')).toContainText('Your turn');
  });

  test('fits a 1024x768 screen with every square reachable', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const doc = document.scrollingElement;
      if (doc === null) throw new Error('no scrolling element');
      return {
        vertical: doc.scrollHeight - doc.clientHeight,
        horizontal: doc.scrollWidth - doc.clientWidth,
      };
    });

    expect(overflow).toEqual({ vertical: 0, horizontal: 0 });

    // Both boards have to be reachable without scrolling: an earlier build fitted the
    // controls but cut off enemy rows 7-10, which made half the grid unclickable.
    const cells = page.getByRole('button', { name: /^[A-J]\d+, / });
    await expect(cells).toHaveCount(200);
    const offscreen = await cells.evaluateAll(
      (nodes) =>
        nodes.filter((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.top < 0 ||
            box.left < 0 ||
            box.bottom > window.innerHeight ||
            box.right > window.innerWidth
          );
        }).length,
    );

    expect(offscreen).toBe(0);
    await expect(page.getByRole('button', { name: 'Start game' })).toBeInViewport({
      ratio: 1,
    });
  });

  test('keeps two-digit move numbers legible', async ({ page }) => {
    await page.getByRole('button', { name: 'Random layout' }).click();
    await page.getByRole('button', { name: 'Start game' }).click();

    const enemy = page.getByRole('region', { name: 'Enemy waters' });
    const log = page.getByRole('list', { name: 'Move log' });

    for (const square of ['A1', 'B1', 'C1', 'D1', 'E1']) {
      await enemy.getByRole('button', { name: new RegExp(`^${square}, `) }).click();
      await expect(page.getByRole('status')).toContainText('Your turn');
    }

    await expect(log.getByRole('listitem')).toHaveCount(10);

    // Outside markers are drawn in the list's left padding, so too little of it silently
    // clips the leading digit and move 10 reads as "0".
    const room = await log.evaluate((list) => {
      const style = getComputedStyle(list);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('no 2d context');
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return {
        padding: parseFloat(style.paddingLeft),
        marker: context.measureText(`${list.children.length}.`).width,
      };
    });

    expect(room.padding).toBeGreaterThanOrEqual(room.marker);
  });
});
