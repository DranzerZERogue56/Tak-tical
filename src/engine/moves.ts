import { boardFull, flatCount, isOpeningPly, reserveTotal, squareAt } from './state';
import { computeResult } from './result';
import {
  Coord,
  DIRECTIONS,
  Direction,
  GameState,
  Move,
  Piece,
  PlaceMove,
  Square,
  StackMove,
  StoneType,
  idx,
  inBounds,
  opponent,
  topPiece,
} from './types';

/**
 * Whether `count` pieces (the last `count` of the carried stack) may be
 * dropped on the square, given whether this is the final drop of the move.
 * `carriedTop` is the piece that ends up on top after this drop completes
 * the move (only meaningful when it's the final drop).
 */
function canDropOn(sq: Square, isFinalDrop: boolean, dropCount: number, finalTop: Piece | null): boolean {
  const top = topPiece(sq);
  if (!top) return true;
  if (top.type === 'F') return true;
  if (top.type === 'C') return false;
  // wall: only a capstone moving alone, as the final drop
  return (
    isFinalDrop && dropCount === 1 && finalTop !== null && finalTop.type === 'C'
  );
}

function enumerateDropSequences(
  state: GameState,
  from: Coord,
  dir: Direction,
  pickup: number,
  carried: readonly Piece[], // in drop order (bottom of carried stack first)
  out: Move[]
): void {
  const delta = DIRECTIONS[dir];
  const size = state.size;

  // recursive: at each entered square choose how many to drop (>=1)
  const recurse = (pos: Coord, remaining: number, drops: number[]) => {
    const next = { x: pos.x + delta.x, y: pos.y + delta.y };
    if (!inBounds(size, next)) return;
    const sq = squareAt(state, next);
    for (let d = 1; d <= remaining; d++) {
      const isFinal = d === remaining;
      const finalTop = isFinal ? carried[carried.length - 1] : null;
      if (!canDropOn(sq, isFinal, d, finalTop)) {
        // walls/caps block: no drop count works if blocked for non-final;
        // for a wall, only the final-capstone case passes, handled above.
        if (topPiece(sq) && topPiece(sq)!.type !== 'F') break;
        continue;
      }
      const newDrops = [...drops, d];
      if (isFinal) {
        out.push({ kind: 'stack', from, dir, drops: newDrops });
      } else {
        recurse(next, remaining - d, newDrops);
      }
    }
  };

  recurse(from, pickup, []);
}

export function getLegalMoves(state: GameState): Move[] {
  if (state.result) return [];
  const moves: Move[] = [];
  const { size, currentPlayer } = state;

  // First-turn rule: place one of the opponent's flats on any empty square.
  if (isOpeningPly(state)) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (squareAt(state, { x, y }).length === 0) {
          moves.push({ kind: 'place', to: { x, y }, stone: 'F' });
        }
      }
    }
    return moves;
  }

  const reserve = state.reserves[currentPlayer];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = { x, y };
      const sq = squareAt(state, c);

      // placements
      if (sq.length === 0) {
        if (reserve.flats > 0) {
          moves.push({ kind: 'place', to: c, stone: 'F' });
          moves.push({ kind: 'place', to: c, stone: 'S' });
        }
        if (reserve.caps > 0) {
          moves.push({ kind: 'place', to: c, stone: 'C' });
        }
        continue;
      }

      // stack moves: must control the stack (own piece on top)
      const top = topPiece(sq)!;
      if (top.player !== currentPlayer) continue;
      const carryLimit = Math.min(sq.length, size);
      for (let pickup = 1; pickup <= carryLimit; pickup++) {
        const carried = sq.slice(sq.length - pickup); // drop order
        for (const dir of ['+', '-', '<', '>'] as Direction[]) {
          enumerateDropSequences(state, c, dir, pickup, carried, moves);
        }
      }
    }
  }

  return moves;
}

function movesEqual(a: Move, b: Move): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'place' && b.kind === 'place') {
    return a.to.x === b.to.x && a.to.y === b.to.y && a.stone === b.stone;
  }
  if (a.kind === 'stack' && b.kind === 'stack') {
    return (
      a.from.x === b.from.x &&
      a.from.y === b.from.y &&
      a.dir === b.dir &&
      a.drops.length === b.drops.length &&
      a.drops.every((d, i) => d === b.drops[i])
    );
  }
  return false;
}

export function isLegalMove(state: GameState, move: Move): boolean {
  return getLegalMoves(state).some((m) => movesEqual(m, move));
}

/**
 * Apply a move, returning the new immutable state. Throws on illegal moves.
 * The result (win/draw) is evaluated only after the move fully completes.
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegalMove(state, move)) {
    throw new Error(`Illegal move: ${JSON.stringify(move)}`);
  }

  const { size, currentPlayer } = state;
  const board = state.board.map((sq) => sq); // shallow copy; squares replaced as needed
  const reserves = {
    1: { ...state.reserves[1] },
    2: { ...state.reserves[2] },
  };

  if (move.kind === 'place') {
    // On opening plies the placed stone belongs to (and comes from) the opponent.
    const owner = isOpeningPly(state) ? opponent(currentPlayer) : currentPlayer;
    const piece: Piece = { player: owner, type: move.stone };
    if (move.stone === 'C') reserves[owner].caps -= 1;
    else reserves[owner].flats -= 1;
    const i = idx(size, move.to);
    board[i] = [...board[i], piece];
  } else {
    const fromI = idx(size, move.from);
    const fromSq = board[fromI];
    const pickup = move.drops.reduce((a, b) => a + b, 0);
    const carried = fromSq.slice(fromSq.length - pickup); // drop order
    board[fromI] = fromSq.slice(0, fromSq.length - pickup);

    const delta = DIRECTIONS[move.dir];
    let pos = { ...move.from };
    let taken = 0;
    for (const d of move.drops) {
      pos = { x: pos.x + delta.x, y: pos.y + delta.y };
      const i = idx(size, pos);
      let sq = board[i];
      const top = topPiece(sq);
      if (top && top.type === 'S') {
        // capstone flattens the wall (legality already verified)
        sq = [...sq.slice(0, sq.length - 1), { ...top, type: 'F' }];
      }
      board[i] = [...sq, ...carried.slice(taken, taken + d)];
      taken += d;
    }
  }

  const nextPly = state.ply + 1;
  const next: GameState = {
    size,
    board,
    reserves,
    currentPlayer: opponent(currentPlayer),
    ply: nextPly,
    moveNumber: Math.floor(nextPly / 2) + 1,
    history: [...state.history, move],
    result: null,
  };

  return { ...next, result: computeResult(next, currentPlayer) };
}

export { boardFull, flatCount, reserveTotal };
