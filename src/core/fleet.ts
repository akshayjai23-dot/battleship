import type { Fleet, Ship, ShipKind } from './types';

export type ShipSpec = {
  readonly kind: ShipKind;
  readonly size: number;
  readonly label: string;
};

/** The standard fleet. Both sides always have exactly these five ships. */
export const FLEET_SPEC: readonly ShipSpec[] = [
  { kind: 'carrier', size: 5, label: 'Carrier' },
  { kind: 'battleship', size: 4, label: 'Battleship' },
  { kind: 'cruiser', size: 3, label: 'Cruiser' },
  { kind: 'submarine', size: 3, label: 'Submarine' },
  { kind: 'destroyer', size: 2, label: 'Destroyer' },
];

export const TOTAL_SHIP_CELLS = FLEET_SPEC.reduce((sum, spec) => sum + spec.size, 0);

export function specFor(kind: ShipKind): ShipSpec {
  const spec = FLEET_SPEC.find((candidate) => candidate.kind === kind);
  if (!spec) throw new Error(`Unknown ship kind: ${kind}`);
  return spec;
}

export function labelFor(kind: ShipKind): string {
  return specFor(kind).label;
}

/** Sunk is always derived from damage, never stored, so the two cannot disagree. */
export function isSunk(ship: Ship): boolean {
  return ship.hits.every(Boolean);
}

export function isFleetDestroyed(fleet: Fleet): boolean {
  return fleet.length > 0 && fleet.every(isSunk);
}

export function remainingShips(fleet: Fleet): Fleet {
  return fleet.filter((ship) => !isSunk(ship));
}

/** The kinds still to be placed, in canonical order. */
export function unplacedKinds(fleet: Fleet): ShipKind[] {
  const placed = new Set(fleet.map((ship) => ship.kind));
  return FLEET_SPEC.filter((spec) => !placed.has(spec.kind)).map((spec) => spec.kind);
}

export function isFleetComplete(fleet: Fleet): boolean {
  return unplacedKinds(fleet).length === 0;
}
