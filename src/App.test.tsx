import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { seedFromLocation } from './App';
import { AI_DELAY_MS } from './ui/useGame';

const SEED = 4242;

/** Places a full fleet and starts the game, the way a player would. */
async function startGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Random layout' }));
  await user.click(screen.getByRole('button', { name: 'Start game' }));
}

function enemyBoard() {
  return within(screen.getByRole('region', { name: 'Enemy waters' }));
}

function ownBoard() {
  return within(screen.getByRole('region', { name: 'Your waters' }));
}

/** Lets the AI's scheduled reply run. */
async function letAiMove() {
  await act(async () => {
    vi.advanceTimersByTime(AI_DELAY_MS);
  });
}

describe('seedFromLocation', () => {
  it('uses the seed in the query string when it is valid', () => {
    expect(seedFromLocation('?seed=99')).toBe(99);
  });

  it('falls back to a generated seed when it is missing or nonsense', () => {
    expect(seedFromLocation('?seed=abc')).not.toBeNaN();
    expect(seedFromLocation('')).not.toBeNaN();
    expect(seedFromLocation('?seed=-1')).toBeGreaterThanOrEqual(0);
  });
});

describe('setup', () => {
  it('asks the player to place their fleet and refuses to start early', () => {
    render(<App initialSeed={SEED} />);

    expect(screen.getByRole('status')).toHaveTextContent('Place your fleet to begin.');
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled();
  });

  it('places a selected ship where the player clicks', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.click(ownBoard().getByRole('button', { name: 'A1, water' }));

    expect(ownBoard().getByRole('button', { name: 'A1, your ship' })).toBeInTheDocument();
    expect(ownBoard().getByRole('button', { name: 'E1, your ship' })).toBeInTheDocument();
  });

  it('advances to the next ship after each placement', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.click(ownBoard().getByRole('button', { name: 'A1, water' }));

    expect(screen.getByRole('button', { name: /Battleship/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explains a rejected placement instead of silently ignoring it', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.click(screen.getByRole('button', { name: /Carrier/ }));
    await user.click(ownBoard().getByRole('button', { name: 'H1, water' }));

    expect(screen.getByText(/does not fit/i)).toBeInTheDocument();
    expect(ownBoard().queryByRole('button', { name: 'H1, your ship' })).toBeNull();
  });

  it('previews the ship under the cursor before it is placed', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.hover(ownBoard().getByRole('button', { name: 'A1, water' }));

    expect(
      ownBoard().getByRole('button', { name: 'A1, placement preview' }),
    ).toBeInTheDocument();
  });

  it('previews an illegal placement as invalid', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.hover(ownBoard().getByRole('button', { name: 'H1, water' }));

    expect(
      ownBoard().getByRole('button', { name: 'H1, invalid placement' }),
    ).toBeInTheDocument();
  });

  it('rotates, clears and randomizes the layout', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.click(screen.getByRole('button', { name: /Rotate to vertical/ }));
    await user.click(ownBoard().getByRole('button', { name: 'A1, water' }));
    expect(ownBoard().getByRole('button', { name: 'A5, your ship' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear board' }));
    expect(ownBoard().queryByRole('button', { name: /your ship/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Random layout' }));
    expect(ownBoard().getAllByRole('button', { name: /your ship/ })).toHaveLength(17);
    expect(screen.getByRole('button', { name: 'Start game' })).toBeEnabled();
  });

  it('removes a placed ship', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.click(ownBoard().getByRole('button', { name: 'A1, water' }));
    await user.click(screen.getByRole('button', { name: 'Remove Carrier' }));

    expect(ownBoard().queryByRole('button', { name: /your ship/ })).toBeNull();
  });

  it('still accepts placements after the board is cleared', async () => {
    // Regression: the selected ship was component state that emptied once the fleet was
    // full, so after Clear board every click on the grid did nothing at all.
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    for (const square of ['A1', 'A3', 'A5', 'A7', 'A9']) {
      await user.click(ownBoard().getByRole('button', { name: `${square}, water` }));
    }
    expect(screen.getByRole('button', { name: 'Start game' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Clear board' }));
    await user.click(ownBoard().getByRole('button', { name: 'A1, water' }));

    expect(ownBoard().getAllByRole('button', { name: /your ship/ })).toHaveLength(5);
  });

  it('starts placing the removed ship again after it is taken off the board', async () => {
    const user = userEvent.setup();
    render(<App initialSeed={SEED} />);

    await user.click(screen.getByRole('button', { name: 'Random layout' }));
    await user.click(screen.getByRole('button', { name: 'Remove Destroyer' }));
    await user.click(ownBoard().getByRole('button', { name: 'A10, water' }));

    expect(ownBoard().getAllByRole('button', { name: /your ship/ })).toHaveLength(17);
  });

  it('hides the enemy fleet entirely', async () => {
    render(<App initialSeed={SEED} />);
    expect(enemyBoard().queryByRole('button', { name: /your ship/ })).toBeNull();
    expect(enemyBoard().getAllByRole('button', { name: /water/ })).toHaveLength(100);
  });
});

describe('playing', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires at the enemy, then lets the AI reply', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App initialSeed={SEED} />);
    await startGame(user);

    expect(screen.getByRole('status')).toHaveTextContent('Your turn');
    await user.click(enemyBoard().getByRole('button', { name: 'A1, water' }));

    expect(enemyBoard().queryByRole('button', { name: 'A1, water' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('The AI is taking its shot');

    await letAiMove();

    expect(screen.getByRole('status')).toHaveTextContent('Your turn');
    expect(
      within(screen.getByRole('list', { name: 'Move log' })).getAllByRole('listitem'),
    ).toHaveLength(2);
  });

  it('locks the enemy board while the AI is thinking', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App initialSeed={SEED} />);
    await startGame(user);

    await user.click(enemyBoard().getByRole('button', { name: 'A1, water' }));

    expect(enemyBoard().getByRole('button', { name: 'B1, water' })).toBeDisabled();
  });

  it('does not let the player fire twice at the same square', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App initialSeed={SEED} />);
    await startGame(user);

    await user.click(enemyBoard().getByRole('button', { name: 'A1, water' }));
    await letAiMove();

    const alreadyFired = enemyBoard().getAllByRole('button', {
      name: /A1, (hit|miss)/,
    })[0]!;
    await user.click(alreadyFired);

    expect(screen.getByText(/already fired at A1/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Your turn');
  });

  it('stops the AI mid-turn when a new game is started', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App initialSeed={SEED} />);
    await startGame(user);

    await user.click(enemyBoard().getByRole('button', { name: 'A1, water' }));
    await user.click(screen.getByRole('button', { name: 'New game' }));
    await letAiMove();

    // The abandoned game's timer must not fire into the fresh one.
    expect(screen.getByRole('status')).toHaveTextContent('Place your fleet to begin.');
    expect(ownBoard().queryByRole('button', { name: /hit|miss/ })).toBeNull();
    expect(
      within(screen.getByRole('list', { name: 'Move log' })).queryAllByRole('listitem'),
    ).toHaveLength(0);
  });

  it('is playable with the keyboard alone', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App initialSeed={SEED} />);
    await startGame(user);

    const target = enemyBoard().getByRole('button', { name: 'A1, water' });
    target.focus();
    await user.keyboard('{Enter}');

    expect(enemyBoard().queryByRole('button', { name: 'A1, water' })).toBeNull();
  });

  it('plays a full game through to a result', { timeout: 30_000 }, async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App initialSeed={SEED} />);
    await startGame(user);

    for (let i = 0; i < 100; i += 1) {
      const remaining = enemyBoard().queryAllByRole('button', { name: /water/ });
      const status = screen.getByRole('status').textContent ?? '';
      if (status.includes('win') || status.includes('lose')) break;
      if (remaining.length === 0) break;
      await user.click(remaining[0]!);
      await letAiMove();
    }

    expect(screen.getByRole('status').textContent).toMatch(/You (win|lose)/);
    // Nothing may move after the result is in.
    const log = within(screen.getByRole('list', { name: 'Move log' })).getAllByRole(
      'listitem',
    );
    await letAiMove();
    expect(
      within(screen.getByRole('list', { name: 'Move log' })).getAllByRole('listitem'),
    ).toHaveLength(log.length);
  });
});
