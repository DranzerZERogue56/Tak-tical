export type Player = 1 | 2;

/** F = flat stone, S = standing stone (wall), C = capstone */
export type StoneType = 'F' | 'S' | 'C';

export interface Piece {
  player: Player;
  type: StoneType;
}

export interface Coord {
  x: number; // 0-based column, a=0
  y: number; // 0-based row, 1=0
}

/** PTN direction characters: + north (y+), - south (y-), > east (x+), < west (x-) */
export type Direction = '+' | '-' | '<' | '>';

export interface PlaceMove {
  kind: 'place';
  to: Coord;
  stone: StoneType;
}

export interface StackMove {
  kind: 'stack';
  from: Coord;
  dir: Direction;
  /** pieces dropped on each successive square entered; sum = pickup count */
  drops: number[];
}

export type Move = PlaceMove | StackMove;

export interface Reserve {
  flats: number;
  caps: number;
}

export type ResultType = 'road' | 'flat' | 'draw';

export interface GameResult {
  type: ResultType;
  winner?: Player;
  /** squares forming the winning road (road wins only) */
  road?: Coord[];
  /** PTN result string, e.g. "R-0", "0-F", "1/2-1/2" */
  ptn: string;
}

/** A square is an ordered stack of pieces, bottom first. */
export type Square = readonly Piece[];

export interface GameState {
  readonly size: number;
  /** row-major: board[y * size + x] */
  readonly board: readonly Square[];
  readonly reserves: Readonly<Record<Player, Reserve>>;
  readonly currentPlayer: Player;
  /** number of half-moves (plies) played so far */
  readonly ply: number;
  /** full-move number of the NEXT move, starting at 1 */
  readonly moveNumber: number;
  readonly history: readonly Move[];
  readonly result: GameResult | null;
}

export const DIRECTIONS: Record<Direction, Coord> = {
  '+': { x: 0, y: 1 },
  '-': { x: 0, y: -1 },
  '>': { x: 1, y: 0 },
  '<': { x: -1, y: 0 },
};

export const PIECE_COUNTS: Record<number, Reserve> = {
  3: { flats: 10, caps: 0 },
  4: { flats: 15, caps: 0 },
  5: { flats: 21, caps: 1 },
  6: { flats: 30, caps: 1 },
  7: { flats: 40, caps: 2 },
  8: { flats: 50, caps: 2 },
};

export function opponent(p: Player): Player {
  return p === 1 ? 2 : 1;
}

export function idx(size: number, c: Coord): number {
  return c.y * size + c.x;
}

export function inBounds(size: number, c: Coord): boolean {
  return c.x >= 0 && c.x < size && c.y >= 0 && c.y < size;
}

export function topPiece(sq: Square): Piece | null {
  return sq.length > 0 ? sq[sq.length - 1] : null;
}
