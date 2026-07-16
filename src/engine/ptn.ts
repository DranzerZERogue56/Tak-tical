import { createInitialState } from './state';
import { applyMove } from './moves';
import {
  Coord,
  Direction,
  GameState,
  Move,
  StoneType,
} from './types';

export function coordToSquare(c: Coord): string {
  return String.fromCharCode(97 + c.x) + String(c.y + 1);
}

export function squareToCoord(sq: string): Coord {
  const x = sq.charCodeAt(0) - 97;
  const y = parseInt(sq.slice(1), 10) - 1;
  if (Number.isNaN(y) || x < 0 || x > 7 || y < 0 || y > 7) {
    throw new Error(`Invalid PTN square: ${sq}`);
  }
  return { x, y };
}

/** Serialize a single move to PTN. */
export function moveToPtn(move: Move): string {
  if (move.kind === 'place') {
    const prefix = move.stone === 'F' ? '' : move.stone;
    return prefix + coordToSquare(move.to);
  }
  const pickup = move.drops.reduce((a, b) => a + b, 0);
  const count = pickup === 1 ? '' : String(pickup);
  const drops =
    move.drops.length === 1 ? '' : move.drops.map(String).join('');
  return count + coordToSquare(move.from) + move.dir + drops;
}

const MOVE_RE =
  /^([CS])?([a-h][1-8])$|^([1-8])?([a-h][1-8])([+\-<>])([1-8]*)\*?$/;

/** Parse a single PTN move (evaluation marks like ' ! ? are stripped). */
export function ptnToMove(ptn: string): Move {
  const cleaned = ptn.replace(/['!?]+$/, '');
  const m = MOVE_RE.exec(cleaned);
  if (!m) throw new Error(`Invalid PTN move: ${ptn}`);
  if (m[2]) {
    const stone: StoneType = (m[1] as StoneType) ?? 'F';
    return { kind: 'place', to: squareToCoord(m[2]), stone };
  }
  const pickup = m[3] ? parseInt(m[3], 10) : 1;
  const from = squareToCoord(m[4]!);
  const dir = m[5] as Direction;
  const drops = m[6]
    ? m[6].split('').map((d) => parseInt(d, 10))
    : [pickup];
  const sum = drops.reduce((a, b) => a + b, 0);
  if (sum !== pickup) {
    throw new Error(`PTN drop counts (${m[6]}) don't sum to pickup ${pickup}: ${ptn}`);
  }
  return { kind: 'stack', from, dir, drops };
}

/** Serialize a full game to PTN, with headers and numbered move pairs. */
export function gameToPtn(state: GameState, headers?: Record<string, string>): string {
  const lines: string[] = [];
  const allHeaders: Record<string, string> = {
    Size: String(state.size),
    ...headers,
  };
  if (state.result) allHeaders.Result = state.result.ptn;
  for (const [k, v] of Object.entries(allHeaders)) {
    lines.push(`[${k} "${v}"]`);
  }
  lines.push('');

  for (let i = 0; i < state.history.length; i += 2) {
    const num = i / 2 + 1;
    let line = `${num}. ${moveToPtn(state.history[i])}`;
    if (i + 1 < state.history.length) {
      line += ` ${moveToPtn(state.history[i + 1])}`;
    }
    lines.push(line);
  }
  if (state.result) lines.push(state.result.ptn);
  return lines.join('\n');
}

const RESULT_TOKENS = new Set(['R-0', '0-R', 'F-0', '0-F', '1-0', '0-1', '1/2-1/2']);

/**
 * Parse a PTN game and replay it through the engine, validating every move.
 * Returns the resulting state.
 */
export function ptnToGame(ptn: string): GameState {
  let size: number | null = null;
  const moveTokens: string[] = [];

  for (const rawLine of ptn.split('\n')) {
    const line = rawLine.replace(/\{[^}]*\}/g, '').trim(); // strip comments
    if (!line) continue;
    const header = /^\[(\w+)\s+"([^"]*)"\]$/.exec(line);
    if (header) {
      if (header[1] === 'Size') size = parseInt(header[2], 10);
      continue;
    }
    for (const token of line.split(/\s+/)) {
      if (/^\d+\.$/.test(token)) continue; // move number
      if (RESULT_TOKENS.has(token)) continue;
      moveTokens.push(token);
    }
  }

  if (!size) throw new Error('PTN missing Size header');
  let state = createInitialState(size);
  for (const token of moveTokens) {
    state = applyMove(state, ptnToMove(token));
  }
  return state;
}
