import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Coord,
  Direction,
  GameState,
  Move,
  StackMove,
  StoneType,
  gameToPtn,
  getLegalMoves,
  isOpeningPly,
  moveToPtn,
  squareAt,
} from '../engine';
import { useGameStore } from '../store/gameStore';
import { Board } from '../components/Board';
import { Button } from '../components/common';
import { theme, fontSizes } from '../theme';

type Interaction =
  | { mode: 'idle' }
  | { mode: 'placePicker'; to: Coord }
  | { mode: 'pickCount'; from: Coord }
  | {
      mode: 'moving';
      from: Coord;
      pickup: number;
      dir: Direction | null;
      drops: number[];
      /** square awaiting a drop-count choice */
      pending: Coord | null;
    };

function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

function nextSquare(from: Coord, dir: Direction, steps: number): Coord {
  const d = { '+': [0, 1], '-': [0, -1], '>': [1, 0], '<': [-1, 0] }[dir];
  return { x: from.x + d[0] * steps, y: from.y + d[1] * steps };
}

function dirBetween(a: Coord, b: Coord): Direction | null {
  if (a.x === b.x && b.y === a.y + 1) return '+';
  if (a.x === b.x && b.y === a.y - 1) return '-';
  if (a.y === b.y && b.x === a.x + 1) return '>';
  if (a.y === b.y && b.x === a.x - 1) return '<';
  return null;
}

export function GameScreen({ onExit, onRules }: { onExit: () => void; onRules: () => void }) {
  const session = useGameStore((s) => s.session);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const playHumanMove = useGameStore((s) => s.playHumanMove);
  const runAiTurnIfNeeded = useGameStore((s) => s.runAiTurnIfNeeded);
  const undo = useGameStore((s) => s.undo);

  const [interaction, setInteraction] = useState<Interaction>({ mode: 'idle' });
  const [inspecting, setInspecting] = useState<Coord | null>(null);
  const [showLog, setShowLog] = useState(false);
  const { width } = useWindowDimensions();

  const state: GameState | null = session?.state ?? null;

  // AI turn driver: runs whenever it's the AI's move
  useEffect(() => {
    void runAiTurnIfNeeded();
  }, [state?.ply, session?.humanPlayer, runAiTurnIfNeeded]);

  const legalMoves = useMemo(
    () => (state && !state.result ? getLegalMoves(state) : []),
    [state]
  );

  if (!session || !state) return null;

  const humanTurn =
    !state.result && !aiThinking && state.currentPlayer === session.humanPlayer;
  const boardPx = Math.min(width - 34, 420);

  // ---- interaction helpers -------------------------------------------

  const stackMovesFrom = (from: Coord): StackMove[] =>
    legalMoves.filter(
      (m): m is StackMove => m.kind === 'stack' && sameCoord(m.from, from)
    );

  const placementsAt = (to: Coord) =>
    legalMoves.filter(
      (m): m is Extract<Move, { kind: 'place' }> =>
        m.kind === 'place' && sameCoord(m.to, to)
    );

  const candidatesForMoving = (i: Extract<Interaction, { mode: 'moving' }>) =>
    stackMovesFrom(i.from).filter((m) => {
      const total = m.drops.reduce((a, b) => a + b, 0);
      if (total !== i.pickup) return false;
      if (i.dir && m.dir !== i.dir) return false;
      if (m.drops.length < i.drops.length) return false;
      return i.drops.every((d, k) => m.drops[k] === d);
    });

  const commitIfComplete = (i: Extract<Interaction, { mode: 'moving' }>) => {
    const dropped = i.drops.reduce((a, b) => a + b, 0);
    if (dropped === i.pickup && i.dir) {
      playHumanMove({ kind: 'stack', from: i.from, dir: i.dir, drops: i.drops });
      setInteraction({ mode: 'idle' });
      return true;
    }
    return false;
  };

  const chooseDrop = (d: number) => {
    if (interaction.mode !== 'moving' || !interaction.pending) return;
    const dir =
      interaction.dir ?? dirBetween(interaction.from, interaction.pending)!;
    const next: Extract<Interaction, { mode: 'moving' }> = {
      ...interaction,
      dir,
      drops: [...interaction.drops, d],
      pending: null,
    };
    if (!commitIfComplete(next)) setInteraction(next);
  };

  const onSquarePress = (c: Coord) => {
    if (!humanTurn) {
      setInspecting(squareAt(state, c).length > 0 ? c : null);
      return;
    }

    if (interaction.mode === 'moving') {
      const i = interaction;
      const stepIndex = i.drops.length + 1;
      const expected = i.dir
        ? nextSquare(i.from, i.dir, stepIndex)
        : null;
      const tapDir = i.drops.length === 0 ? dirBetween(i.from, c) : null;
      const valid =
        (expected && sameCoord(c, expected)) ||
        (tapDir !== null &&
          candidatesForMoving({ ...i, dir: tapDir }).length > 0);
      if (valid) {
        const dir = i.dir ?? dirBetween(i.from, c)!;
        const opts = dropOptions({ ...i, dir, pending: c });
        if (opts.length === 1) {
          const next: Extract<Interaction, { mode: 'moving' }> = {
            ...i,
            dir,
            drops: [...i.drops, opts[0]],
            pending: null,
          };
          if (!commitIfComplete(next)) setInteraction(next);
        } else {
          setInteraction({ ...i, dir, pending: c });
        }
        return;
      }
      setInteraction({ mode: 'idle' });
      return;
    }

    const sq = squareAt(state, c);
    if (sq.length === 0) {
      const places = placementsAt(c);
      if (places.length === 0) return;
      if (isOpeningPly(state) || places.length === 1) {
        playHumanMove(places[0]);
      } else {
        setInteraction({ mode: 'placePicker', to: c });
      }
      return;
    }

    const top = sq[sq.length - 1];
    if (top.player === session.humanPlayer && stackMovesFrom(c).length > 0) {
      const maxPickup = Math.min(sq.length, state.size);
      if (maxPickup === 1) {
        setInteraction({ mode: 'moving', from: c, pickup: 1, dir: null, drops: [], pending: null });
      } else {
        setInteraction({ mode: 'pickCount', from: c });
      }
    } else {
      setInspecting(c);
    }
  };

  const dropOptions = (
    i: Extract<Interaction, { mode: 'moving' }> & { pending: Coord }
  ): number[] => {
    const cands = candidatesForMoving(i);
    const k = i.drops.length;
    const opts = new Set<number>();
    for (const m of cands) {
      if (m.drops.length > k) opts.add(m.drops[k]);
    }
    return [...opts].sort((a, b) => a - b);
  };

  // squares to highlight during a move
  const highlights: Coord[] = [];
  if (interaction.mode === 'moving' && humanTurn) {
    const i = interaction;
    if (i.pending) {
      // waiting on drop count; nothing more to highlight
    } else if (i.dir) {
      const nxt = nextSquare(i.from, i.dir, i.drops.length + 1);
      if (candidatesForMoving(i).some((m) => m.drops.length > i.drops.length)) {
        highlights.push(nxt);
      }
    } else {
      for (const dir of ['+', '-', '<', '>'] as Direction[]) {
        if (candidatesForMoving({ ...i, dir }).length > 0) {
          highlights.push(nextSquare(i.from, dir, 1));
        }
      }
    }
  }

  const selected =
    interaction.mode === 'moving' || interaction.mode === 'pickCount'
      ? interaction.from
      : interaction.mode === 'placePicker'
        ? interaction.to
        : null;

  // ---- subviews ------------------------------------------------------

  const reserve1 = state.reserves[1];
  const reserve2 = state.reserves[2];
  const result = state.result;

  const statusText = result
    ? result.type === 'draw'
      ? 'Draw — equal flats'
      : `${result.winner === session.humanPlayer ? 'You win' : 'AI wins'} by ${result.type === 'road' ? 'road' : 'flat count'} (${result.ptn})`
    : aiThinking
      ? 'AI is thinking…'
      : humanTurn
        ? isOpeningPly(state)
          ? "Your turn — place an opponent's flat"
          : 'Your turn'
        : "AI's turn";

  const ptnLog = state.history.map((m, i) => ({
    n: Math.floor(i / 2) + 1,
    white: i % 2 === 0,
    text: moveToPtn(m),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tak {state.size}×{state.size}</Text>
        <Text style={styles.dim}>{session.difficulty} {session.style} AI</Text>
      </View>

      <View style={styles.reserveRow}>
        <ReserveBadge
          label={session.humanPlayer === 1 ? 'You (light)' : 'AI (light)'}
          flats={reserve1.flats}
          caps={reserve1.caps}
          active={!result && state.currentPlayer === 1}
          light
        />
        <ReserveBadge
          label={session.humanPlayer === 2 ? 'You (dark)' : 'AI (dark)'}
          flats={reserve2.flats}
          caps={reserve2.caps}
          active={!result && state.currentPlayer === 2}
        />
      </View>

      <Text style={[styles.status, result != null && { color: theme.accent }]}>
        {statusText}
      </Text>

      <View style={{ alignItems: 'center' }}>
        <Board
          state={state}
          boardPx={boardPx}
          selected={selected}
          highlights={highlights}
          roadSquares={result?.road ?? []}
          onSquarePress={onSquarePress}
        />
      </View>

      {interaction.mode === 'moving' && (
        <View style={styles.movingBar}>
          <Text style={styles.dim}>
            Carrying {interaction.pickup - interaction.drops.reduce((a, b) => a + b, 0)} of {interaction.pickup}
          </Text>
          {interaction.pending && (
            <View style={styles.dropRow}>
              <Text style={styles.dim}>Drop:</Text>
              {dropOptions({ ...interaction, pending: interaction.pending }).map(
                (d) => (
                  <Button
                    key={d}
                    label={String(d)}
                    onPress={() => chooseDrop(d)}
                    style={{ paddingVertical: 6, paddingHorizontal: 14 }}
                  />
                )
              )}
            </View>
          )}
          <Button
            label="Cancel"
            kind="secondary"
            onPress={() => setInteraction({ mode: 'idle' })}
            style={{ paddingVertical: 6 }}
          />
        </View>
      )}

      <View style={styles.controls}>
        <Button
          label="Undo"
          kind="secondary"
          disabled={!humanTurn || session.snapshots.length === 0}
          onPress={() => {
            setInteraction({ mode: 'idle' });
            undo();
          }}
        />
        <Button label="Moves" kind="secondary" onPress={() => setShowLog(true)} />
        <Button label="Rules" kind="secondary" onPress={onRules} />
        <Button label="Menu" kind="secondary" onPress={onExit} />
      </View>

      {/* piece-type picker */}
      <Modal
        transparent
        visible={interaction.mode === 'placePicker'}
        animationType="fade"
        onRequestClose={() => setInteraction({ mode: 'idle' })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Place a piece</Text>
            {interaction.mode === 'placePicker' &&
              placementsAt(interaction.to).map((m) => (
                <Button
                  key={m.stone}
                  label={
                    m.stone === 'F'
                      ? `Flat (${state.reserves[session.humanPlayer].flats} left)`
                      : m.stone === 'S'
                        ? `Wall (${state.reserves[session.humanPlayer].flats} left)`
                        : `Capstone (${state.reserves[session.humanPlayer].caps} left)`
                  }
                  kind={m.stone === 'F' ? 'primary' : 'secondary'}
                  onPress={() => {
                    playHumanMove(m);
                    setInteraction({ mode: 'idle' });
                  }}
                  style={{ marginTop: 8 }}
                />
              ))}
            <Button
              label="Cancel"
              kind="secondary"
              onPress={() => setInteraction({ mode: 'idle' })}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>

      {/* pickup count picker */}
      <Modal
        transparent
        visible={interaction.mode === 'pickCount'}
        animationType="fade"
        onRequestClose={() => setInteraction({ mode: 'idle' })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pick up how many?</Text>
            <View style={styles.dropRow}>
              {interaction.mode === 'pickCount' &&
                [...new Set(
                  stackMovesFrom(interaction.from).map((m) =>
                    m.drops.reduce((a, b) => a + b, 0)
                  )
                )]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <Button
                      key={n}
                      label={String(n)}
                      onPress={() =>
                        setInteraction({
                          mode: 'moving',
                          from: (interaction as Extract<Interaction, { mode: 'pickCount' }>).from,
                          pickup: n,
                          dir: null,
                          drops: [],
                          pending: null,
                        })
                      }
                    />
                  ))}
            </View>
            <Button
              label="Cancel"
              kind="secondary"
              onPress={() => setInteraction({ mode: 'idle' })}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>

      {/* stack inspector */}
      <Modal
        transparent
        visible={inspecting !== null}
        animationType="fade"
        onRequestClose={() => setInspecting(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Stack at {inspecting ? String.fromCharCode(97 + inspecting.x) + (inspecting.y + 1) : ''}
            </Text>
            {inspecting &&
              [...squareAt(state, inspecting)].reverse().map((p, i) => (
                <Text key={i} style={styles.stackLine}>
                  {i === 0 ? 'top  ' : '     '}
                  {p.player === 1 ? 'Light' : 'Dark'}{' '}
                  {p.type === 'F' ? 'flat' : p.type === 'S' ? 'wall' : 'capstone'}
                </Text>
              ))}
            <Button
              label="Close"
              kind="secondary"
              onPress={() => setInspecting(null)}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>

      {/* move log */}
      <Modal
        transparent
        visible={showLog}
        animationType="slide"
        onRequestClose={() => setShowLog(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '75%' }]}>
            <Text style={styles.modalTitle}>Move log (PTN)</Text>
            <ScrollView style={{ marginVertical: 10 }}>
              {ptnLog.length === 0 && (
                <Text style={styles.dim}>No moves yet.</Text>
              )}
              {ptnLog
                .reduce<{ n: number; w?: string; b?: string }[]>((acc, m) => {
                  if (m.white) acc.push({ n: m.n, w: m.text });
                  else acc[acc.length - 1].b = m.text;
                  return acc;
                }, [])
                .map((row) => (
                  <Text key={row.n} style={styles.ptnLine}>
                    {row.n}. {row.w ?? ''} {row.b ?? ''}
                  </Text>
                ))}
            </ScrollView>
            <Button
              label="Share / export PTN"
              onPress={() => {
                void Share.share({ message: gameToPtn(state) });
              }}
            />
            <Button
              label="Close"
              kind="secondary"
              onPress={() => setShowLog(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ReserveBadge({
  label,
  flats,
  caps,
  active,
  light,
}: {
  label: string;
  flats: number;
  caps: number;
  active: boolean;
  light?: boolean;
}) {
  return (
    <View
      style={[
        styles.reserveBadge,
        active && { borderColor: theme.accent },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: light ? theme.p1 : theme.p2,
            borderWidth: 1,
            borderColor: light ? theme.p1Edge : theme.p2Edge,
          }}
        />
        <Text style={styles.reserveLabel}>{label}</Text>
      </View>
      <Text style={styles.dim}>
        {flats} flats{caps > 0 ? ` · ${caps} cap${caps > 1 ? 's' : ''}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 16,
    paddingTop: 54,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    color: theme.text,
    fontSize: fontSizes.h1,
    fontWeight: '700',
  },
  dim: {
    color: theme.textDim,
    fontSize: fontSizes.body,
  },
  status: {
    color: theme.text,
    fontSize: fontSizes.h2,
    marginVertical: 10,
    textAlign: 'center',
  },
  reserveRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  reserveBadge: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 9,
    gap: 3,
  },
  reserveLabel: {
    color: theme.text,
    fontSize: fontSizes.small,
    fontWeight: '600',
  },
  movingBar: {
    marginTop: 12,
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  dropRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
    marginBottom: 24,
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: {
    color: theme.text,
    fontSize: fontSizes.h2,
    fontWeight: '700',
    textAlign: 'center',
  },
  stackLine: {
    color: theme.text,
    fontFamily: 'monospace',
    fontSize: fontSizes.body,
    marginTop: 6,
  },
  ptnLine: {
    color: theme.text,
    fontFamily: 'monospace',
    fontSize: fontSizes.body,
    marginTop: 4,
  },
});
