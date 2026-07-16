import {
  GameState,
  Player,
  idx,
  opponent,
  topPiece,
} from '../engine/types';

const WIN = 1_000_000;

/** Tunable evaluation weights; each bot style is a different profile. */
export interface EvalWeights {
  /** controlling a square with a flat (counts toward roads and flat win) */
  flat: number;
  /** controlling a square with a capstone (counts toward roads) */
  cap: number;
  /** controlling a square with a wall (blocks, no road/flat credit) */
  wall: number;
  /** per step of distance from the board edge */
  centrality: number;
  /** enemy piece buried under a stack we control */
  captiveEnemy: number;
  /** friendly piece supporting a stack we control */
  captiveFriendly: number;
  /** quadratic row/column concentration multiplier */
  line: number;
  /** flat bonus for a row/column that is one square short of a road */
  threatLine: number;
  /** per square of the largest connected road group */
  group: number;
}

export const DEFAULT_WEIGHTS: EvalWeights = {
  flat: 100,
  cap: 70,
  wall: 30,
  centrality: 4,
  captiveEnemy: 14,
  captiveFriendly: 6,
  line: 3,
  threatLine: 60,
  group: 12,
};

export type BotStyle = 'balanced' | 'aggressor' | 'roadrunner' | 'fortress';

export const BOT_STYLES: Record<BotStyle, EvalWeights> = {
  balanced: DEFAULT_WEIGHTS,
  // hunts stacks: values capturing enemy pieces and wall pressure
  aggressor: {
    ...DEFAULT_WEIGHTS,
    flat: 90,
    wall: 40,
    captiveEnemy: 26,
    threatLine: 50,
    group: 10,
  },
  // races roads: values connectivity and near-complete lines above all
  roadrunner: {
    ...DEFAULT_WEIGHTS,
    flat: 95,
    centrality: 6,
    captiveEnemy: 8,
    line: 5,
    threatLine: 90,
    group: 20,
  },
  // plays solid: values walls, supported stacks, and the flat count
  fortress: {
    ...DEFAULT_WEIGHTS,
    flat: 105,
    wall: 45,
    centrality: 3,
    captiveEnemy: 12,
    captiveFriendly: 10,
    threatLine: 55,
    group: 10,
  },
};

/**
 * Heuristic evaluation from `p`'s perspective. Considers flat count,
 * road connectivity potential, road threats, stack control (captives),
 * and piece placement.
 */
export function evaluate(
  state: GameState,
  p: Player,
  w: EvalWeights = DEFAULT_WEIGHTS
): number {
  if (state.result) {
    if (state.result.type === 'draw') return 0;
    return state.result.winner === p ? WIN - state.ply : -(WIN - state.ply);
  }
  return scoreFor(state, p, w) - scoreFor(state, opponent(p), w);
}

function scoreFor(state: GameState, p: Player, w: EvalWeights): number {
  const { size, board } = state;
  let score = 0;

  // per-square features
  const roadSq = new Array<boolean>(size * size).fill(false);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sq = board[idx(size, { x, y })];
      const top = topPiece(sq);
      if (!top || top.player !== p) continue;

      // control of the square
      if (top.type === 'F') {
        score += w.flat;
        roadSq[idx(size, { x, y })] = true;
      } else if (top.type === 'C') {
        score += w.cap;
        roadSq[idx(size, { x, y })] = true;
      } else {
        score += w.wall;
      }

      // centrality helps roads
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      score += (cx + cy) * w.centrality;

      // captives (enemy pieces buried under our control) and friendly support
      for (let i = 0; i < sq.length - 1; i++) {
        score += sq[i].player === p ? w.captiveFriendly : w.captiveEnemy;
      }
    }
  }

  // road potential: for each row and column, count our road squares;
  // reward concentration (quadratic-ish) since near-complete lines matter
  // more, and flag near-complete lines as explicit threats.
  for (let y = 0; y < size; y++) {
    let n = 0;
    for (let x = 0; x < size; x++) if (roadSq[idx(size, { x, y })]) n++;
    score += n * n * w.line;
    if (n === size - 1) score += w.threatLine;
  }
  for (let x = 0; x < size; x++) {
    let n = 0;
    for (let y = 0; y < size; y++) if (roadSq[idx(size, { x, y })]) n++;
    score += n * n * w.line;
    if (n === size - 1) score += w.threatLine;
  }

  // largest connected road group
  score += largestGroup(state, roadSq) * w.group;

  return score;
}

function largestGroup(state: GameState, roadSq: boolean[]): number {
  const { size } = state;
  const seen = new Array<boolean>(size * size).fill(false);
  let best = 0;
  for (let start = 0; start < size * size; start++) {
    if (!roadSq[start] || seen[start]) continue;
    let count = 0;
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const i = stack.pop()!;
      count++;
      const x = i % size;
      const y = Math.floor(i / size);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const ni = ny * size + nx;
        if (roadSq[ni] && !seen[ni]) {
          seen[ni] = true;
          stack.push(ni);
        }
      }
    }
    best = Math.max(best, count);
  }
  return best;
}

export { WIN };
