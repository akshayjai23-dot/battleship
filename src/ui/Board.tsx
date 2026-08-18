import { BOARD_SIZE } from '../core/types';
import type { Coord } from '../core/types';
import { describeCell, type CellView } from './cells';

const COLUMN_LETTERS = [...'ABCDEFGHIJ'];

type BoardProps = {
  readonly title: string;
  readonly cells: readonly CellView[];
  readonly disabled: boolean;
  readonly onSelect?: (coord: Coord) => void;
  readonly onHover?: (coord: Coord | undefined) => void;
};

/**
 * A 10x10 grid of buttons. The component knows nothing about the rules: it renders the
 * cell states it is handed and reports which square was chosen.
 */
export function Board({ title, cells, disabled, onSelect, onHover }: BoardProps) {
  return (
    <section className="board" aria-label={title}>
      <h2>{title}</h2>
      <div className="grid" onMouseLeave={() => onHover?.(undefined)}>
        <span aria-hidden="true" className="corner" />
        {COLUMN_LETTERS.map((letter) => (
          <span aria-hidden="true" className="header" key={letter}>
            {letter}
          </span>
        ))}
        {Array.from({ length: BOARD_SIZE }, (_, row) => (
          <Row
            key={row}
            row={row}
            cells={cells.slice(row * BOARD_SIZE, (row + 1) * BOARD_SIZE)}
            disabled={disabled}
            {...(onSelect ? { onSelect } : {})}
            {...(onHover ? { onHover } : {})}
          />
        ))}
      </div>
    </section>
  );
}

type RowProps = {
  readonly row: number;
  readonly cells: readonly CellView[];
  readonly disabled: boolean;
  readonly onSelect?: (coord: Coord) => void;
  readonly onHover?: (coord: Coord | undefined) => void;
};

function Row({ row, cells, disabled, onSelect, onHover }: RowProps) {
  return (
    <>
      <span aria-hidden="true" className="header">
        {row + 1}
      </span>
      {cells.map((cell) => (
        <button
          key={cell.key}
          type="button"
          className={`cell cell--${cell.state}`}
          disabled={disabled}
          aria-label={describeCell(cell)}
          onClick={() => onSelect?.(cell.coord)}
          onMouseEnter={() => onHover?.(cell.coord)}
          onFocus={() => onHover?.(cell.coord)}
        />
      ))}
    </>
  );
}
