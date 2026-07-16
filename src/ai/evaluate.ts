import {
  GameState,
  Player,
  idx,
  opponent,
  topPiece,
} from '../engine/types';

const WIN = 1_000_000;

/**
 * Heuristic evaluation from `p`'s perspective. Considers flat count,
 * road connectivity potential, stack control (captives), and piece placement.
 */
export function evaluate(state: GameState, p: Player): number {
  if (state.result) {
    if (state.result.type === 'draw') return 0;
    return state.result.winner === p ? WIN - state.ply : -(WIN - state.ply);
  }
  return scoreFor(state, p) - scoreFor(state, opponent(p));
}

function scoreFor(state: GameState, p: Player): number {
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
        score += 100; // flats score toward flat win
        roadSq[idx(size, { x, y })] = true;
      } else if (top.type === 'C') {
        score += 70;
        roadSq[idx(size, { x, y })] = true;
      } else {
        score += 30; // wall controls but doesn't count for roads/flats
      }

      // centrality helps roads
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      score += (cx + cy) * 4;

      // captives (enemy pieces buried under our control) and friendly support
      for (let i = 0; i < sq.length - 1; i++) {
        score += sq[i].player === p ? 6 : 14;
      }
    }
  }

  // road potential: for each row and column, count our road squares;
  // reward concentration (quadratic-ish) since near-complete lines matter more.
  for (let y = 0; y < size; y++) {
    let n = 0;
    for (let x = 0; x < size; x++) if (roadSq[idx(size, { x, y })]) n++;
    score += n * n * 3;
  }
  for (let x = 0; x < size; x++) {
    let n = 0;
    for (let y = 0; y < size; y++) if (roadSq[idx(size, { x, y })]) n++;
    score += n * n * 3;
  }

  // largest connected road group
  score += largestGroup(state, roadSq) * 12;

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
