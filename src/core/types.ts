/** The side length of the (square) board. */
export const BOARD_SIZE = 10;

/**
 * A board position. Always zero-indexed internally; conversion to and from the
 * player-facing "B4" notation happens only in `coords.ts`, at the UI boundary.
 */
export type Coord = { readonly row: number; readonly col: number };

export type Orientation = 'horizontal' | 'vertical';

export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

/**
 * A ship, and the authoritative record of the damage it has taken.
 *
 * `hits` is indexed along the ship's own length (0 is the cell at `origin`), which makes
 * "the same segment hit twice" unrepresentable and lets `isSunk` be derived rather than
 * stored. The rendered grid is always computed from the fleet, never the other way
 * round, so the two cannot disagree.
 */
export type Ship = {
  readonly kind: ShipKind;
  readonly size: number;
  readonly origin: Coord;
  readonly orientation: Orientation;
  readonly hits: readonly boolean[];
};

export type Fleet = readonly Ship[];

/** A coordinate flattened to a string so it can key a plain object. */
export type CellKey = string;

export type ShotMark = 'hit' | 'miss';

/**
 * One side's board: its fleet, plus every shot the *opponent* has fired at it.
 *
 * `shots` is a plain object rather than a Map so that state stays serializable, spreads
 * immutably, and prints readably in failed assertions.
 */
export type PlayerBoard = {
  readonly fleet: Fleet;
  readonly shots: Readonly<Record<CellKey, ShotMark>>;
};

/** The outcome of firing at a board. Rejections carry a reason and change nothing. */
export type ShotOutcome =
  | { readonly type: 'miss' }
  | { readonly type: 'hit'; readonly ship: ShipKind }
  | { readonly type: 'sunk'; readonly ship: ShipKind }
  | { readonly type: 'rejected'; readonly reason: RejectionReason };

export type RejectionReason = 'off-board' | 'already-targeted';

/** Why a proposed ship placement is illegal. */
export type PlacementError = 'off-board' | 'overlap' | 'already-placed';

/** Which player a board, shot or log entry belongs to. */
export type Side = 'player' | 'ai';
