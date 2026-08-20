import { useEffect, useReducer } from 'react';
import { createGame, reduce, type Action, type GameState } from '../core/game';

/** Long enough that the AI's reply reads as a move, short enough not to annoy. */
export const AI_DELAY_MS = 650;

/**
 * Holds the game state and schedules the AI's reply.
 *
 * The timer is the only piece of real asynchrony in the app, and it is deliberately
 * dumb: it dispatches `aiFire` and nothing else. Correctness does not depend on it
 * firing exactly once — the effect clears its own timer, and the reducer ignores
 * `aiFire` outside the AI's turn, so a late timer from an abandoned game is a no-op.
 */
export function useGame(seed: number): readonly [GameState, (action: Action) => void] {
  const [state, dispatch] = useReducer(reduce, seed, createGame);

  useEffect(() => {
    if (state.phase.name !== 'aiTurn') return;
    const timer = setTimeout(() => dispatch({ type: 'aiFire' }), AI_DELAY_MS);
    return () => clearTimeout(timer);
    // `turn` is in the dependency list so a new AI turn schedules a new timer even
    // though the phase name is unchanged from the previous one.
  }, [state.phase.name, state.turn]);

  return [state, dispatch];
}
