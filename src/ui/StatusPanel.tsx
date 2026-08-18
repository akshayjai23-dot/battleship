import { formatCoord } from '../core/coords';
import { isSunk, labelFor } from '../core/fleet';
import type { GameState, LogEntry } from '../core/game';
import type { Fleet } from '../core/types';

/** The single sentence describing where the game stands. */
export function statusText(state: GameState): string {
  switch (state.phase.name) {
    case 'setup':
      return 'Place your fleet to begin.';
    case 'playerTurn':
      return 'Your turn — choose a square on the enemy waters.';
    case 'aiTurn':
      return 'The AI is taking its shot…';
    case 'gameOver':
      return state.phase.winner === 'player'
        ? 'You win — the enemy fleet is sunk.'
        : 'You lose — your fleet is sunk.';
  }
}

function describeEntry(entry: LogEntry): string {
  const who = entry.side === 'player' ? 'You' : 'AI';
  const where = formatCoord(entry.coord);
  switch (entry.outcome.type) {
    case 'miss':
      return `${who} fired at ${where} — miss.`;
    case 'hit':
      return `${who} fired at ${where} — hit.`;
    case 'sunk':
      return `${who} fired at ${where} — sank the ${labelFor(entry.outcome.ship)}.`;
  }
}

export function StatusPanel({ state }: { readonly state: GameState }) {
  return (
    <section className="panel" aria-label="Game status">
      {/* Announced to screen readers so the AI's move is not a purely visual event. */}
      <p className="status" role="status">
        {statusText(state)}
      </p>
      {state.notice !== undefined && <p className="notice">{state.notice}</p>}

      <div className="fleets">
        <FleetStatus title="Your fleet" fleet={state.human.fleet} />
        <FleetStatus title="Enemy fleet" fleet={state.ai.fleet} />
      </div>

      <h2>Move log</h2>
      <ol className="log" aria-label="Move log">
        {[...state.log].reverse().map((entry, index) => (
          <li key={state.log.length - index}>{describeEntry(entry)}</li>
        ))}
      </ol>
    </section>
  );
}

function FleetStatus({
  title,
  fleet,
}: {
  readonly title: string;
  readonly fleet: Fleet;
}) {
  return (
    <div>
      <h3>{title}</h3>
      <ul aria-label={title}>
        {fleet.map((ship) => (
          <li key={ship.kind} className={isSunk(ship) ? 'sunk-ship' : undefined}>
            {labelFor(ship.kind)}
            {isSunk(ship) ? ' — sunk' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
