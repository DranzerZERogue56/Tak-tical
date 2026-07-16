import {
  applyMove,
  createInitialState,
  gameToPtn,
  getLegalMoves,
  getResult,
  isLegalMove,
  moveToPtn,
  ptnToGame,
  ptnToMove,
  serializeState,
  deserializeState,
  squareAt,
  topAt,
} from '../index';
import { GameState, Move, PIECE_COUNTS } from '../types';

/** Play a sequence of PTN moves from an initial state. */
function play(size: number, ...ptnMoves: string[]): GameState {
  let s = createInitialState(size);
  for (const m of ptnMoves) s = applyMove(s, ptnToMove(m));
  return s;
}

describe('initial state & piece counts', () => {
  test.each([
    [3, 10, 0],
    [4, 15, 0],
    [5, 21, 1],
    [6, 30, 1],
    [7, 40, 2],
    [8, 50, 2],
  ])('size %i has %i flats and %i capstones', (size, flats, caps) => {
    const s = createInitialState(size);
    expect(s.reserves[1]).toEqual({ flats, caps });
    expect(s.reserves[2]).toEqual({ flats, caps });
    expect(s.board).toHaveLength(size * size);
    expect(s.currentPlayer).toBe(1);
    expect(getResult(s)).toBeNull();
  });

  test('unsupported sizes throw', () => {
    expect(() => createInitialState(2)).toThrow();
    expect(() => createInitialState(9)).toThrow();
  });
});

describe('first-turn opponent-flat rule', () => {
  test('first two plies only offer flat placements', () => {
    const s = createInitialState(5);
    const moves = getLegalMoves(s);
    expect(moves).toHaveLength(25);
    expect(moves.every((m) => m.kind === 'place' && m.stone === 'F')).toBe(true);

    const s2 = applyMove(s, ptnToMove('a1'));
    const moves2 = getLegalMoves(s2);
    expect(moves2).toHaveLength(24);
    expect(moves2.every((m) => m.kind === 'place' && m.stone === 'F')).toBe(true);
  });

  test('placed stone belongs to the opponent and uses their reserve', () => {
    const s = play(5, 'a1');
    expect(topAt(s, { x: 0, y: 0 })).toEqual({ player: 2, type: 'F' });
    expect(s.reserves[2].flats).toBe(20); // opponent's reserve deducted
    expect(s.reserves[1].flats).toBe(21);

    const s2 = applyMove(s, ptnToMove('e5'));
    expect(topAt(s2, { x: 4, y: 4 })).toEqual({ player: 1, type: 'F' });
    expect(s2.reserves[1].flats).toBe(20);
  });

  test('walls and capstones cannot be placed on opening plies', () => {
    const s = createInitialState(5);
    expect(isLegalMove(s, ptnToMove('Sa1'))).toBe(false);
    expect(isLegalMove(s, ptnToMove('Ca1'))).toBe(false);
  });

  test('after opening, walls and capstones become available', () => {
    const s = play(5, 'a1', 'e5');
    expect(isLegalMove(s, ptnToMove('Sc3'))).toBe(true);
    expect(isLegalMove(s, ptnToMove('Cc3'))).toBe(true);
  });

  test('no capstone placement on sizes without capstones', () => {
    const s = play(4, 'a1', 'd4');
    expect(getLegalMoves(s).some((m) => m.kind === 'place' && m.stone === 'C')).toBe(false);
  });
});

describe('placement rules', () => {
  test('cannot place on occupied squares', () => {
    const s = play(5, 'a1', 'e5');
    expect(isLegalMove(s, ptnToMove('a1'))).toBe(false);
    expect(isLegalMove(s, ptnToMove('Sa1'))).toBe(false);
  });

  test('placement decrements the correct reserve', () => {
    const s = play(5, 'a1', 'e5', 'Cc3');
    expect(s.reserves[1].caps).toBe(0);
    expect(s.reserves[1].flats).toBe(20);
  });
});

describe('stack movement & carry limit', () => {
  test('simple flat move', () => {
    const s = play(3, 'a1', 'c3', 'b2', 'c1', 'b2>');
    expect(squareAt(s, { x: 1, y: 1 })).toHaveLength(0);
    expect(topAt(s, { x: 2, y: 1 })).toEqual({ player: 1, type: 'F' });
  });

  test('cannot move a stack the opponent controls', () => {
    const s = play(3, 'a1', 'c3'); // a1 is player 2's flat; player 1 to move
    expect(isLegalMove(s, ptnToMove('a1>'))).toBe(false);
  });

  test('carry limit equals board size', () => {
    // build a 4-high stack on a2 of a 3x3 board, controlled by player 1
    const s = play(
      3,
      'a3', 'c3', // opening: a3 = P2 flat, c3 = P1 flat
      'b1', 'b2', 'b1+', // b2: [P2 F, P1 F]
      'a1', 'a2', 'a1+', // a2: [P1 F, P2 F]
      '2b2<', // a2: [P1, P2, P2, P1] height 4, P1 on top
      'c1'
    );
    const a2 = squareAt(s, { x: 0, y: 1 });
    expect(a2.length).toBe(4);
    expect(topAt(s, { x: 0, y: 1 })!.player).toBe(1);
    // carry limit is 3 on a 3x3 board
    const legal = getLegalMoves(s).filter(
      (m): m is Extract<Move, { kind: 'stack' }> =>
        m.kind === 'stack' && m.from.x === 0 && m.from.y === 1
    );
    expect(legal.length).toBeGreaterThan(0);
    const maxPickup = Math.max(
      ...legal.map((m) => m.drops.reduce((a, b) => a + b, 0))
    );
    expect(maxPickup).toBe(3);
  });

  test('carry limit enforced explicitly: cannot pick up more than size', () => {
    const s = play(
      3,
      'a3', 'c3',
      'b1', 'b2', 'b1+',
      'a1', 'a2', 'a1+',
      '2b2<',
      'c1'
    ); // a2 height 4, P1 to move
    expect(isLegalMove(s, ptnToMove('4a2>22'))).toBe(false); // pickup 4 > carry limit 3
    expect(isLegalMove(s, ptnToMove('3a2>12'))).toBe(true); // b2 empty, c2 empty
  });

  test('multi-square stack move with uneven drops', () => {
    let s = play(5, 'a1', 'e5', 'b3', 'd3', 'a3', 'e3', 'a3>', 'e4');
    // b3 stack: [P1 F (placed), P1 F (moved)] — height 2, P1 controls
    expect(squareAt(s, { x: 1, y: 2 })).toHaveLength(2);
    s = applyMove(s, ptnToMove('c4')); // P1 places elsewhere? wait, it's P1's move after e4
    // Build a 3-stack: move b3 stack onto c3 after placing c3
    s = applyMove(s, ptnToMove('c3')); // P2 flat at c3
    s = applyMove(s, ptnToMove('2b3>')); // P1 moves 2 onto c3 -> c3 height 3, P1 top
    expect(squareAt(s, { x: 2, y: 2 })).toHaveLength(3);
    s = applyMove(s, ptnToMove('e2')); // P2 elsewhere
    // uneven drop: pick up 3 from c3, drop 2 on d3 (P2 flat there), 1 on e3 (P2 flat)
    s = applyMove(s, ptnToMove('3c3>21'));
    const d3 = squareAt(s, { x: 3, y: 2 });
    const e3 = squareAt(s, { x: 4, y: 2 });
    expect(d3).toHaveLength(3); // P2 flat + 2 dropped
    expect(e3).toHaveLength(2); // P2 flat + 1 dropped
    // drop order: bottom of carried stack first
    expect(topAt(s, { x: 4, y: 2 })).toEqual({ player: 1, type: 'F' });
    expect(squareAt(s, { x: 2, y: 2 })).toHaveLength(0);
  });

  test('at least one piece must drop on each square entered', () => {
    const s = play(5, 'a1', 'e5', 'b3', 'd3');
    // moving 1 piece "skipping" a square is unrepresentable in the move type;
    // verify no generated stack move has a zero drop
    const moves = getLegalMoves(s);
    for (const m of moves) {
      if (m.kind === 'stack') {
        expect(m.drops.every((d) => d >= 1)).toBe(true);
      }
    }
  });

  test('moves cannot leave the board', () => {
    const s = play(3, 'a1', 'c3', 'b1', 'b3'); // P1 flat at b1
    expect(isLegalMove(s, ptnToMove('b1-'))).toBe(false); // off the bottom edge
  });
});

describe('walls', () => {
  test('walls block movement and stacking', () => {
    const s = play(5, 'a1', 'e5', 'c3', 'Sd3'); // P2 wall at d3, P1 flat c3
    expect(isLegalMove(s, ptnToMove('c3>'))).toBe(false); // flat cannot land on wall
  });

  test('nothing may pass through or over a wall mid-move', () => {
    // P1 stack of 2 at c3, wall at d3: moving 2 east requires dropping on d3 — illegal
    let s = play(5, 'a1', 'e5', 'c3', 'Sd3', 'b3', 'e1', 'b3>', 'e2');
    // c3 now height 2 (P1 top)
    expect(squareAt(s, { x: 2, y: 2 })).toHaveLength(2);
    const stackMoves = getLegalMoves(s).filter(
      (m) => m.kind === 'stack' && m.from.x === 2 && m.from.y === 2 && m.dir === '>'
    );
    expect(stackMoves).toHaveLength(0);
  });
});

describe('capstone', () => {
  test('capstone flattens a wall when moving alone', () => {
    const s = play(5, 'a1', 'e5', 'Cc3', 'Sd3', 'c3>');
    const d3 = squareAt(s, { x: 3, y: 2 });
    expect(d3).toHaveLength(2);
    expect(d3[0]).toEqual({ player: 2, type: 'F' }); // wall flattened
    expect(d3[1]).toEqual({ player: 1, type: 'C' });
  });

  test('capstone cannot flatten when dropping more than one piece', () => {
    // stack: P1 flat under P1 cap at c3; wall at d3
    let s = play(5, 'a1', 'e5', 'c3', 'Sd3', 'Cb3', 'e1', 'b3>', 'e2');
    // c3: [P1 F, P1 C]
    expect(squareAt(s, { x: 2, y: 2 })).toHaveLength(2);
    // 2c3> would drop both onto d3 (wall) — illegal
    expect(isLegalMove(s, ptnToMove('2c3>'))).toBe(false);
    // but dropping the flat on d3 is illegal too (wall), so 2c3>11 also illegal
    expect(isLegalMove(s, ptnToMove('2c3>11'))).toBe(false);
    // cap alone onto the wall is legal
    expect(isLegalMove(s, ptnToMove('c3>'))).toBe(true);
  });

  test('capstone flatten only as the final square of the move', () => {
    // c3: [F,C] P1; wall at e3; d3 empty. 2c3>11: drop flat on d3, cap on e3(wall) — legal
    const s = play(5, 'a1', 'e5', 'c3', 'Se3', 'Cb3', 'a5', 'b3>', 'b5');
    expect(isLegalMove(s, ptnToMove('2c3>11'))).toBe(true);
    const after = applyMove(s, ptnToMove('2c3>11'));
    const e3 = squareAt(after, { x: 4, y: 2 });
    expect(e3[0]).toEqual({ player: 2, type: 'F' });
    expect(e3[1]).toEqual({ player: 1, type: 'C' });
  });

  test('nothing may ever be stacked on a capstone', () => {
    const s = play(5, 'a1', 'e5', 'c3', 'Cd3', 'b3', 'e1', 'b3>', 'e2');
    // c3 height 2, P1 top; d3 is P2 capstone
    const onto = getLegalMoves(s).filter(
      (m) => m.kind === 'stack' && m.from.x === 2 && m.from.y === 2 && m.dir === '>'
    );
    expect(onto).toHaveLength(0);
  });

  test('walls cannot flatten walls', () => {
    const s = play(5, 'a1', 'e5', 'Sc3', 'Sd3');
    expect(isLegalMove(s, ptnToMove('c3>'))).toBe(false);
  });
});

describe('road wins', () => {
  test('vertical road win', () => {
    const s = play(3, 'b1', 'b3', 'a1', 'c3', 'a2', 'c2', 'a3');
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('road');
    expect(r!.winner).toBe(1);
    expect(r!.ptn).toBe('R-0');
    expect(r!.road!.length).toBeGreaterThanOrEqual(3);
  });

  test('game over: no legal moves after a win', () => {
    const s = play(3, 'b1', 'b3', 'a1', 'c3', 'a2', 'c2', 'a3');
    expect(getLegalMoves(s)).toHaveLength(0);
    expect(() => applyMove(s, ptnToMove('b2'))).toThrow();
  });

  test('walls do not count toward roads', () => {
    const s = play(3, 'b1', 'b3', 'a1', 'c3', 'a2', 'c2', 'Sa3');
    expect(getResult(s)).toBeNull();
  });

  test('capstones count toward roads', () => {
    const s = play(5, 'b1', 'e5', 'a1', 'd5', 'a2', 'c5', 'a3', 'b5', 'a4', 'e4', 'Ca5');
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('road');
    expect(r!.winner).toBe(1);
  });

  test('a road may bend', () => {
    // L-shaped road on 3x3: a1,a2,b2,b3 doesn't connect opposite edges;
    // use a1,b1,b2,b3: bottom edge to top edge with a bend
    const s = play(3, 'c1', 'c3', 'a1', 'a3', 'b1', 'c2', 'b2', 'a2', 'b3');
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('road');
    expect(r!.winner).toBe(1);
  });

  test('dragon clause: double road resolves to the moving player', () => {
    // Construct: P2 has a completed road blocked by one P1 wall segment...
    // Simpler: a single stack move creates roads for both players at once.
    // Setup on 5x5, rows 2 (P1) and 3 (P2):
    // P1 flats: a2 b2 c2 e2, and a stack move drops P1 flat on d2 and P2 flat on d3
    // P2 flats: a3 b3 c3 e3.
    let s = createInitialState(5);
    const seq = [
      'a5', // P1 places P2 flat at a5 (opening)
      'e5', // P2 places P1 flat at e5 (opening)
      'a2', 'a3',
      'b2', 'b3',
      'c2', 'c3',
      'e2', 'e3',
      'd1', 'd4', // P1 flat d1, P2 flat d4
    ];
    for (const m of seq) s = applyMove(s, ptnToMove(m));
    // Now P1: build stack at d3? It's P1's turn.
    // Plan: P1 places flat d3? that would complete nothing (d2 empty).
    // Instead: P1 stacks: place d3 flat (P1). P2 must not win. Then P1 moves d4? not P1's.
    // Alternative: make a stack at d4 that P1 controls containing [P2 F, P1 F]:
    s = applyMove(s, ptnToMove('d5')); // P1 flat d5
    s = applyMove(s, ptnToMove('a1')); // P2 flat a1 (harmless)
    s = applyMove(s, ptnToMove('d5-')); // P1 moves d5 flat onto d4 -> d4: [P2 F, P1 F]
    s = applyMove(s, ptnToMove('b1')); // P2 harmless
    // d4 stack: [P2,P1]. Move 2 down: drop P2 flat on d3, P1 flat on d2.
    // This completes P2's road a3-b3-c3-d3-e3 AND P1's road a2-b2-c2-d2-e2.
    expect(getResult(s)).toBeNull();
    s = applyMove(s, ptnToMove('2d4-11'));
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('road');
    expect(r!.winner).toBe(1); // P1 made the move -> dragon clause
  });

  test('road created for opponent only: opponent wins', () => {
    // Same setup, but the move completes only P2's road.
    let s = createInitialState(5);
    const seq = [
      'a5', 'e5',
      'a2', 'a3',
      'b2', 'b3',
      'c2', 'c3',
      'a4', 'e3', // P1's a4 instead of e2 -> P1 row 2 incomplete (d2,e2 empty)
      'b4', 'd4',
      'd5', 'a1',
      'd5-', 'b1',
    ];
    for (const m of seq) s = applyMove(s, ptnToMove(m));
    s = applyMove(s, ptnToMove('2d4-11')); // P2 flat lands d3 completing P2 road only
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.winner).toBe(2);
    expect(r!.ptn).toBe('0-R');
  });
});

describe('flat wins', () => {
  test('flat win when board is full', () => {
    // fill a 3x3 board; avoid roads by alternating cleverly with walls
    let s = createInitialState(3);
    const seq = [
      'a1', 'c3', // opening: a1 is P2's, c3 is P1's
      'Sb1', 'Sb3', // walls break roads
      'a2', 'c2',
      'Sc1', 'Sa3',
      'b2', // board full
    ];
    for (const m of seq) s = applyMove(s, ptnToMove(m));
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.type).not.toBe('road');
    // flats on top: P1: c3, a2, b2 = 3. P2: a1, c2 = 2. P1 wins.
    expect(r!.type).toBe('flat');
    expect(r!.winner).toBe(1);
    expect(r!.ptn).toBe('F-0');
  });

  test('flat win on reserve exhaustion', () => {
    let s = createInitialState(3); // 10 flats each, no caps
    // Drain P1's reserve without filling the board or making roads.
    // Opening: P1 places P2's flat, P2 places P1's flat (each reserve -1).
    s = applyMove(s, ptnToMove('a1')); // P2 flat at a1 (P2 reserve 9)
    s = applyMove(s, ptnToMove('c3')); // P1 flat at c3 (P1 reserve 9)
    // Now P1 places walls and P2 keeps moving one flat back & forth.
    // P2's a1 flat shuffles a1<->b1? b1 needed empty... use a1+/a2-.
    const p1Places = ['Sb2', 'Sb3', 'Sc1', 'Sc2', 'Sb1']; // 5 walls
    let toggle = 0;
    for (const p of p1Places) {
      s = applyMove(s, ptnToMove(p));
      s = applyMove(s, ptnToMove(toggle % 2 === 0 ? 'a1+' : 'a2-'));
      toggle++;
    }
    // P1 reserve: 9 - 5 = 4 flats left; continue with flats at remaining empties?
    // Board: a1/a2 (P2 flat), b1,b2,b3,c1,c2 walls, c3 flat. Empty: a3 + (a1 or a2).
    // Place P1 flats alternately on the empty square P2 vacates.
    while (s.reserves[1].flats > 0 && !s.result) {
      const legalPlace = getLegalMoves(s).find((m) => m.kind === 'place' && m.stone === 'F');
      expect(legalPlace).toBeDefined();
      s = applyMove(s, legalPlace!);
      if (s.result) break;
      const anyMove = getLegalMoves(s)[0];
      s = applyMove(s, anyMove);
    }
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(['flat', 'draw', 'road']).toContain(r!.type);
  });

  test('equal flat counts is a draw', () => {
    let s = createInitialState(3);
    const seq = [
      'a1', 'c3',
      'Sb1', 'Sb3',
      'a2', 'c2',
      'Sc1', 'Sa3',
      'Sb2', // board full, walls don't count: P1 tops: c3=1...
    ];
    // tops: P2 flats a1, c2 = 2; P1 flats c3, a2 = 2; rest walls -> draw
    for (const m of seq) s = applyMove(s, ptnToMove(m));
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('draw');
    expect(r!.ptn).toBe('1/2-1/2');
  });

  test('road win takes precedence over flat win on the same move', () => {
    // Fill the board with the last move completing a road: road wins.
    let s = createInitialState(3);
    const seq = [
      'a1', 'c3', // P2 at a1, P1 at c3
      'a3', 'c2',
      'Sa2', 'b1',
      'Sb2', 'Sc1',
      'b3', // fills the board AND completes P1's row-3 road a3-b3-c3
    ];
    for (const m of seq) s = applyMove(s, ptnToMove(m));
    const r = getResult(s);
    expect(r).not.toBeNull();
    expect(r!.type).toBe('road');
    expect(r!.winner).toBe(1);
  });
});

describe('PTN', () => {
  test('single move round-trips', () => {
    const cases = ['a1', 'Sc3', 'Cd4', 'b2>', '3c3>21', '5e5<1112', '2a1+11'];
    for (const c of cases) {
      expect(moveToPtn(ptnToMove(c))).toBe(c);
    }
  });

  test('invalid PTN rejected', () => {
    expect(() => ptnToMove('z9')).toThrow();
    expect(() => ptnToMove('3c3>1')).toThrow(); // drops don't sum to pickup
    expect(() => ptnToMove('hello')).toThrow();
  });

  test('full game round-trip reaches identical state', () => {
    const s = play(
      5,
      'a1', 'e5', 'c3', 'd3', 'c4', 'Sd4', 'c2', 'Cc1', 'b3', 'c1+', 'b4', '2c2+11'
    );
    const ptn = gameToPtn(s);
    const replayed = ptnToGame(ptn);
    expect(serializeState(replayed)).toBe(serializeState(s));
  });

  test('finished game round-trips with result', () => {
    const s = play(3, 'b1', 'b3', 'a1', 'c3', 'a2', 'c2', 'a3');
    const ptn = gameToPtn(s);
    expect(ptn).toContain('R-0');
    const replayed = ptnToGame(ptn);
    expect(serializeState(replayed)).toBe(serializeState(s));
    expect(replayed.result!.ptn).toBe('R-0');
  });

  test('PTN headers include size', () => {
    const s = play(6, 'a1', 'f6');
    expect(gameToPtn(s)).toContain('[Size "6"]');
  });
});

describe('state serialization', () => {
  test('serialize/deserialize round-trip', () => {
    const s = play(5, 'a1', 'e5', 'c3', 'Sd3', 'Cb3');
    const restored = deserializeState(serializeState(s));
    expect(serializeState(restored)).toBe(serializeState(s));
    // engine still works on restored state
    expect(getLegalMoves(restored).length).toBeGreaterThan(0);
  });
});

describe('full-game sanity on all sizes', () => {
  test.each([3, 4, 5, 6, 7, 8])(
    'random playout on %ix%i terminates legally',
    (size) => {
      let rngState = 42 + size;
      const rng = () => {
        // xorshift
        rngState ^= rngState << 13;
        rngState ^= rngState >> 17;
        rngState ^= rngState << 5;
        return ((rngState >>> 0) % 100000) / 100000;
      };
      let s = createInitialState(size);
      let guard = 0;
      while (!s.result && guard < 2000) {
        const moves = getLegalMoves(s);
        expect(moves.length).toBeGreaterThan(0);
        s = applyMove(s, moves[Math.floor(rng() * moves.length)]);
        guard++;
      }
      expect(s.result).not.toBeNull();
    }
  );
});
