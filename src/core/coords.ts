import { BOARD_SIZE, type CellKey, type Coord } from './types';

const COLUMN_LETTERS = 'ABCDEFGHIJ';

export function isOnBoard({ row, col }: Coord): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

export function toKey({ row, col }: Coord): CellKey {
  return `${row},${col}`;
}

export function fromKey(key: CellKey): Coord {
  const [row, col] = key.split(',').map(Number);
  if (row === undefined || col === undefined || Number.isNaN(row) || Number.isNaN(col)) {
    throw new Error(`Malformed cell key: ${key}`);
  }
  return { row, col };
}

/** Every coordinate on the board, in reading order. */
export function allCoords(): Coord[] {
  const coords: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) coords.push({ row, col });
  }
  return coords;
}

/** The up-to-four orthogonal neighbours of a coordinate that lie on the board. */
export function orthogonalNeighbours(coord: Coord): Coord[] {
  const deltas = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  return deltas
    .map((d) => ({ row: coord.row + d.row, col: coord.col + d.col }))
    .filter(isOnBoard);
}

/** Player-facing notation, e.g. `{ row: 3, col: 1 }` -> "B4". */
export function formatCoord({ row, col }: Coord): string {
  const letter = COLUMN_LETTERS[col];
  if (letter === undefined) throw new Error(`Column out of range: ${col}`);
  return `${letter}${row + 1}`;
}

/** Parses player-facing notation. Returns undefined rather than throwing. */
export function parseCoord(text: string): Coord | undefined {
  const match = /^([A-Ja-j])(10|[1-9])$/.exec(text.trim());
  if (!match) return undefined;
  const [, letter, digits] = match as unknown as [string, string, string];
  return { row: Number(digits) - 1, col: COLUMN_LETTERS.indexOf(letter.toUpperCase()) };
}
