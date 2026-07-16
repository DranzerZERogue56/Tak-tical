import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Coord, GameState, Piece, idx } from '../engine';
import { theme } from '../theme';
import { PieceGlyph } from './pieces';

interface BoardProps {
  state: GameState;
  boardPx: number;
  selected?: Coord | null;
  highlights?: Coord[];
  roadSquares?: Coord[];
  onSquarePress: (c: Coord) => void;
}

function PieceView({
  piece,
  cell,
  liftIndex,
}: {
  piece: Piece;
  cell: number;
  liftIndex: number;
}) {
  const offset = -liftIndex * Math.max(2, cell * 0.055);
  return (
    <View style={{ position: 'absolute', transform: [{ translateY: offset }] }}>
      <PieceGlyph piece={piece} size={cell * 0.62} />
    </View>
  );
}

function RoadPulse({ cell }: { cell: number }) {
  const anim = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 550, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: cell,
        height: cell,
        backgroundColor: theme.roadWin,
        opacity: anim,
      }}
    />
  );
}

export function Board({
  state,
  boardPx,
  selected,
  highlights = [],
  roadSquares = [],
  onSquarePress,
}: BoardProps) {
  const { size } = state;
  const cell = Math.floor(boardPx / size);

  const isIn = (list: Coord[], c: Coord) =>
    list.some((q) => q.x === c.x && q.y === c.y);

  const rows = [];
  // render top row (highest y) first
  for (let y = size - 1; y >= 0; y--) {
    const cells = [];
    for (let x = 0; x < size; x++) {
      const c = { x, y };
      const sq = state.board[idx(size, c)];
      const dark = (x + y) % 2 === 0;
      const isSelected = selected && selected.x === x && selected.y === y;
      const isHighlighted = isIn(highlights, c);
      const isRoad = isIn(roadSquares, c);
      // show at most the top 3 pieces layered
      const visible = sq.slice(-3);
      cells.push(
        <Pressable
          key={x}
          onPress={() => onSquarePress(c)}
          style={[
            {
              width: cell,
              height: cell,
              backgroundColor: dark ? theme.boardDark : theme.boardLight,
              alignItems: 'center',
              justifyContent: 'center',
            },
            isSelected && styles.selected,
            isHighlighted && styles.highlighted,
          ]}
        >
          {visible.map((p, i) => (
            <PieceView key={i} piece={p} cell={cell} liftIndex={i} />
          ))}
          {isRoad && <RoadPulse cell={cell} />}
          {sq.length > 1 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{sq.length}</Text>
            </View>
          )}
        </Pressable>
      );
    }
    rows.push(
      <View key={y} style={{ flexDirection: 'row' }}>
        <View style={{ width: 14, justifyContent: 'center' }}>
          <Text style={styles.coordLabel}>{y + 1}</Text>
        </View>
        {cells}
      </View>
    );
  }

  const colLabels = [];
  for (let x = 0; x < size; x++) {
    colLabels.push(
      <Text key={x} style={[styles.coordLabel, { width: cell, textAlign: 'center' }]}>
        {String.fromCharCode(97 + x)}
      </Text>
    );
  }

  return (
    <View>
      {rows}
      <View style={{ flexDirection: 'row', marginLeft: 14 }}>{colLabels}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  selected: {
    borderWidth: 2,
    borderColor: theme.accent,
  },
  highlighted: {
    borderWidth: 2,
    borderColor: theme.highlight,
    backgroundColor: '#3a3420',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: theme.accentDim,
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
  },
  badgeText: {
    color: theme.text,
    fontSize: 10,
    fontWeight: '700',
  },
  coordLabel: {
    color: theme.textDim,
    fontSize: 9,
  },
});
