import { applyMove, createInitialState, getLegalMoves, isLegalMove } from '../../engine';
import { ptnToMove } from '../../engine/ptn';
import { chooseMove } from '../ai';

describe('AI', () => {
  test.each(['easy', 'medium', 'hard', 'expert'] as const)(
    '%s AI returns only legal moves',
    async (difficulty) => {
      let s = createInitialState(4);
      for (let i = 0; i < 6 && !s.result; i++) {
        const m = await chooseMove(s, difficulty);
        expect(isLegalMove(s, m)).toBe(true);
        s = applyMove(s, m);
      }
    },
    30000
  );

  test('AI takes an immediate road win', async () => {
    // P1 has a2,a3 flats; playing a1 (or moving) completes column a? need a1..a3? 3x3
    let s = createInitialState(3);
    for (const m of ['b1', 'b3', 'a1', 'c3', 'a2', 'c2']) {
      s = applyMove(s, ptnToMove(m));
    }
    // P1 to move with a1,a2 flats; a3 completes the road
    for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
      const move = await chooseMove(s, difficulty);
      const after = applyMove(s, move);
      expect(after.result?.winner).toBe(1);
    }
  }, 30000);

  test('easy AI plays full games to completion on 3x3', async () => {
    let s = createInitialState(3);
    let guard = 0;
    while (!s.result && guard < 300) {
      const m = await chooseMove(s, 'easy');
      s = applyMove(s, m);
      guard++;
    }
    expect(s.result).not.toBeNull();
  }, 60000);

  test('AI never cheats: uses moves present in getLegalMoves', async () => {
    let s = createInitialState(5);
    for (let i = 0; i < 4 && !s.result; i++) {
      const legal = getLegalMoves(s);
      const m = await chooseMove(s, 'medium');
      expect(legal.some((l) => JSON.stringify(l) === JSON.stringify(m))).toBe(true);
      s = applyMove(s, m);
    }
  }, 30000);

  test('search AI blocks an immediate opponent road threat', async () => {
    // opening swap puts c1=P2, a1=P1; then P1 plays a2 → P1 threatens a3
    let s = createInitialState(3);
    for (const m of ['c1', 'a1', 'a2']) {
      s = applyMove(s, ptnToMove(m));
    }
    // P2 to move and must block a3 (no win of its own is available)
    for (const difficulty of ['hard', 'expert'] as const) {
      for (const style of ['balanced', 'aggressor', 'roadrunner', 'fortress'] as const) {
        const move = await chooseMove(s, difficulty, Math.random, style);
        const blocked = applyMove(s, move);
        expect(blocked.result).toBeNull();
        // opponent should no longer have an immediate winning reply
        const wins = getLegalMoves(blocked).some((r) => {
          const after = applyMove(blocked, r);
          return after.result?.winner === 1;
        });
        expect(wins).toBe(false);
      }
    }
  }, 60000);

  test('bot styles all return legal moves', async () => {
    let s = createInitialState(5);
    for (const style of ['balanced', 'aggressor', 'roadrunner', 'fortress'] as const) {
      const m = await chooseMove(s, 'medium', Math.random, style);
      expect(isLegalMove(s, m)).toBe(true);
    }
  }, 30000);
});
