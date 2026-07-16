import {
  Coord,
  GameResult,
  GameState,
  Player,
  idx,
  topPiece,
} from './types';
import { boardFull, flatCount, reserveTotal } from './state';

/** Squares counting toward a road for `p`: top piece is p's flat or capstone. */
function roadSquares(state: GameState, p: Player): boolean[] {
  return state.board.map((sq) => {
    const t = topPiece(sq);
    return !!t && t.player === p && (t.type === 'F' || t.type === 'C');
  });
}

/**
 * Find a road for player p: an orthogonally-connected path of road squares
 * linking two opposite edges. Returns the connected component containing the
 * road, or null.
 */
export function findRoad(state: GameState, p: Player): Coord[] | null {
  const { size } = state;
  const road = roadSquares(state, p);
  const visited = new Array<boolean>(size * size).fill(false);

  const component = (start: Coord): Coord[] => {
    const stack = [start];
    const cells: Coord[] = [];
    visited[idx(size, start)] = true;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = { x: c.x + dx, y: c.y + dy };
        if (n.x < 0 || n.x >= size || n.y < 0 || n.y >= size) continue;
        const i = idx(size, n);
        if (!visited[i] && road[i]) {
          visited[i] = true;
          stack.push(n);
        }
      }
    }
    return cells;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = { x, y };
      const i = idx(size, c);
      if (!road[i] || visited[i]) continue;
      const cells = component(c);
      const touchesWest = cells.some((q) => q.x === 0);
      const touchesEast = cells.some((q) => q.x === size - 1);
      const touchesSouth = cells.some((q) => q.y === 0);
      const touchesNorth = cells.some((q) => q.y === size - 1);
      if ((touchesWest && touchesEast) || (touchesSouth && touchesNorth)) {
        return cells;
      }
    }
  }
  return null;
}

/**
 * Evaluate the position after a completed move by `mover`.
 * Road wins take precedence; the dragon clause resolves double roads
 * in favor of the mover. Then flat win on full board or exhausted reserve.
 */
export function computeResult(state: GameState, mover: Player): GameResult | null {
  const road1 = findRoad(state, 1);
  const road2 = findRoad(state, 2);
  if (road1 || road2) {
    let winner: Player;
    if (road1 && road2) winner = mover; // dragon clause
    else winner = road1 ? 1 : 2;
    return {
      type: 'road',
      winner,
      road: (winner === 1 ? road1 : road2)!,
      ptn: winner === 1 ? 'R-0' : '0-R',
    };
  }

  if (boardFull(state) || reserveTotal(state, 1) === 0 || reserveTotal(state, 2) === 0) {
    const f1 = flatCount(state, 1);
    const f2 = flatCount(state, 2);
    if (f1 === f2) return { type: 'draw', ptn: '1/2-1/2' };
    const winner: Player = f1 > f2 ? 1 : 2;
    return {
      type: 'flat',
      winner,
      ptn: winner === 1 ? 'F-0' : '0-F',
    };
  }

  return null;
}

/** Public result accessor per the engine API. */
export function getResult(state: GameState): GameResult | null {
  return state.result;
}
