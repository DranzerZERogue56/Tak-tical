import { applyMove, getLegalMoves } from '../engine/moves';
import { GameState, Move, Player, idx, opponent, topPiece } from '../engine/types';
import { BotStyle, BOT_STYLES, DEFAULT_WEIGHTS, EvalWeights, evaluate, WIN } from './evaluate';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type { BotStyle };
export { BOT_STYLES };

const TIME_BUDGETS: Record<Exclude<Difficulty, 'easy'>, number> = {
  medium: 900,
  hard: 1500,
  expert: 3000,
};

/** Yield to the event loop so the UI stays responsive during search. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------- easy

/**
 * Easy: mostly random, with light heuristics — take an immediate win,
 * prefer flat placements that extend our road presence, avoid giving
 * pieces away by moving stacks onto nothing useful.
 */
function pickEasy(state: GameState, rng: () => number): Move {
  const moves = getLegalMoves(state);
  const me = state.currentPlayer;

  // take an immediate win if available
  for (const m of moves) {
    const after = applyMove(state, m);
    if (after.result && after.result.winner === me) return m;
  }

  const weighted: { move: Move; w: number }[] = moves.map((m) => {
    let w = 1;
    if (m.kind === 'place') {
      if (m.stone === 'F') {
        w = 4;
        // prefer squares adjacent to our existing road pieces
        const { size } = state;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = { x: m.to.x + dx, y: m.to.y + dy };
          if (n.x < 0 || n.x >= size || n.y < 0 || n.y >= size) continue;
          const top = topPiece(state.board[idx(size, n)]);
          if (top && top.player === me && top.type !== 'S') w += 3;
        }
      } else if (m.stone === 'S') {
        w = 1;
      } else {
        w = 2;
      }
    } else {
      // stack moves: mild preference for capturing enemy flats
      w = 2;
    }
    return { move: m, w };
  });

  let total = weighted.reduce((a, b) => a + b.w, 0);
  let r = rng() * total;
  for (const { move, w } of weighted) {
    r -= w;
    if (r <= 0) return move;
  }
  return weighted[weighted.length - 1].move;
}

// ---------------------------------------------------- medium/hard search

interface SearchCtx {
  me: Player;
  deadline: number;
  nodes: number;
  aborted: boolean;
  weights: EvalWeights;
}

function orderMoves(state: GameState, moves: Move[]): Move[] {
  // cheap ordering: placements near center & captures first
  const { size } = state;
  const key = (m: Move): number => {
    if (m.kind === 'place') {
      const cx = Math.min(m.to.x, size - 1 - m.to.x);
      const cy = Math.min(m.to.y, size - 1 - m.to.y);
      return (m.stone === 'F' ? 20 : 10) + cx + cy;
    }
    return 15 + m.drops.length;
  };
  return [...moves].sort((a, b) => key(b) - key(a));
}

function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchCtx
): number {
  ctx.nodes++;
  if ((ctx.nodes & 255) === 0 && now() > ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }
  if (state.result || depth === 0) return evaluate(state, ctx.me, ctx.weights);

  const maximizing = state.currentPlayer === ctx.me;
  const moves = orderMoves(state, getLegalMoves(state));
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const v = alphaBeta(applyMove(state, m), depth - 1, alpha, beta, ctx);
    if (ctx.aborted) return 0;
    if (maximizing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Drop root moves that hand the opponent an immediate win, as long as at
 * least one safe move exists. Bounded by the deadline: whatever hasn't been
 * checked when time runs low is kept (assumed safe).
 */
function filterBlunders(
  state: GameState,
  moves: { move: Move; after: GameState }[],
  deadline: number
): { move: Move; after: GameState }[] {
  const safe: { move: Move; after: GameState }[] = [];
  for (let i = 0; i < moves.length; i++) {
    if (now() > deadline) {
      safe.push(...moves.slice(i));
      break;
    }
    const { after } = moves[i];
    const foe = after.currentPlayer;
    let losing = false;
    for (const reply of getLegalMoves(after)) {
      const next = applyMove(after, reply);
      if (next.result && next.result.winner === foe) {
        losing = true;
        break;
      }
    }
    if (!losing) safe.push(moves[i]);
  }
  return safe.length > 0 ? safe : moves;
}

async function pickSearch(
  state: GameState,
  maxDepth: number,
  budgetMs: number,
  weights: EvalWeights
): Promise<Move> {
  const me = state.currentPlayer;
  const deadline = now() + budgetMs;
  const ordered = orderMoves(state, getLegalMoves(state));

  let rootMoves = ordered.map((move) => ({ move, after: applyMove(state, move) }));
  let bestMove = rootMoves[0].move;

  // immediate win shortcut
  for (const { move, after } of rootMoves) {
    if (after.result && after.result.winner === me) return move;
  }

  // never play into an immediate loss when avoidable; cap the time spent
  // here so most of the budget still goes to the deep search
  rootMoves = filterBlunders(state, rootMoves, now() + budgetMs * 0.3);
  bestMove = rootMoves[0].move;
  await tick();

  // iterative deepening; keep the best fully-completed depth's answer and
  // re-sort root moves by the previous depth's scores so pruning improves
  for (let depth = 1; depth <= maxDepth; depth++) {
    const ctx: SearchCtx = { me, deadline, nodes: 0, aborted: false, weights };
    let iterBest = -Infinity;
    let iterMove: Move | null = null;
    const scores = new Map<Move, number>();
    for (const { move, after } of rootMoves) {
      const v = alphaBeta(after, depth - 1, iterBest, Infinity, ctx);
      if (ctx.aborted) break;
      scores.set(move, v);
      if (v > iterBest) {
        iterBest = v;
        iterMove = move;
      }
      await tick(); // yield between root moves to keep the UI thread free
      if (now() > deadline) {
        ctx.aborted = true;
        break;
      }
    }
    if (!ctx.aborted && iterMove) {
      bestMove = iterMove;
      if (iterBest >= WIN - 1000) break; // forced win found
      rootMoves = [...rootMoves].sort(
        (a, b) => (scores.get(b.move) ?? -Infinity) - (scores.get(a.move) ?? -Infinity)
      );
    } else {
      break; // out of time; use previous depth's result
    }
  }

  return bestMove;
}

/** Depth caps tuned so big boards stay inside the time budget. */
function depthCap(difficulty: Difficulty, size: number): number {
  if (difficulty === 'medium') return size >= 7 ? 2 : 3;
  if (difficulty === 'hard') return size >= 7 ? 3 : size >= 5 ? 4 : 5;
  return size >= 7 ? 4 : size >= 5 ? 5 : 7; // expert
}

/**
 * Choose the AI's move. Async and chunked so it never blocks the UI thread
 * for long stretches; wall-clock capped per difficulty (~0.9–3s).
 */
export async function chooseMove(
  state: GameState,
  difficulty: Difficulty,
  rng: () => number = Math.random,
  style: BotStyle = 'balanced'
): Promise<Move> {
  if (difficulty === 'easy') {
    await tick();
    return pickEasy(state, rng);
  }
  const weights = BOT_STYLES[style] ?? DEFAULT_WEIGHTS;
  return pickSearch(
    state,
    depthCap(difficulty, state.size),
    TIME_BUDGETS[difficulty],
    weights
  );
}
