import {
  Coord,
  GameState,
  Move,
  PIECE_COUNTS,
  Piece,
  Player,
  Square,
  idx,
  topPiece,
} from './types';

export function createInitialState(size: number): GameState {
  const counts = PIECE_COUNTS[size];
  if (!counts) throw new Error(`Unsupported board size: ${size}`);
  return {
    size,
    board: Array.from({ length: size * size }, () => [] as Square),
    reserves: {
      1: { ...counts },
      2: { ...counts },
    },
    currentPlayer: 1,
    ply: 0,
    moveNumber: 1,
    history: [],
    result: null,
  };
}

export function squareAt(state: GameState, c: Coord): Square {
  return state.board[idx(state.size, c)];
}

export function topAt(state: GameState, c: Coord): Piece | null {
  return topPiece(squareAt(state, c));
}

/** True while the first-turn rule is in effect (each player's first placement). */
export function isOpeningPly(state: GameState): boolean {
  return state.ply < 2;
}

/** Total pieces remaining in a player's reserve. */
export function reserveTotal(state: GameState, p: Player): number {
  const r = state.reserves[p];
  return r.flats + r.caps;
}

export function boardFull(state: GameState): boolean {
  return state.board.every((sq) => sq.length > 0);
}

/** Count of flat stones on top of stacks for a player (flat-win scoring). */
export function flatCount(state: GameState, p: Player): number {
  let n = 0;
  for (const sq of state.board) {
    const t = topPiece(sq);
    if (t && t.player === p && t.type === 'F') n++;
  }
  return n;
}

export interface SerializedState {
  v: 1;
  size: number;
  board: Piece[][];
  reserves: GameState['reserves'];
  currentPlayer: Player;
  ply: number;
  moveNumber: number;
  history: Move[];
  result: GameState['result'];
}

export function serializeState(state: GameState): string {
  const s: SerializedState = {
    v: 1,
    size: state.size,
    board: state.board.map((sq) => [...sq]),
    reserves: { 1: { ...state.reserves[1] }, 2: { ...state.reserves[2] } },
    currentPlayer: state.currentPlayer,
    ply: state.ply,
    moveNumber: state.moveNumber,
    history: [...state.history],
    result: state.result,
  };
  return JSON.stringify(s);
}

export function deserializeState(json: string): GameState {
  const s = JSON.parse(json) as SerializedState;
  if (s.v !== 1) throw new Error(`Unknown state version: ${s.v}`);
  return {
    size: s.size,
    board: s.board,
    reserves: s.reserves,
    currentPlayer: s.currentPlayer,
    ply: s.ply,
    moveNumber: s.moveNumber,
    history: s.history,
    result: s.result,
  };
}
