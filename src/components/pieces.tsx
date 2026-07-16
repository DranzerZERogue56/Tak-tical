import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Piece } from '../engine';
import { theme } from '../theme';

/**
 * A single piece drawn with the same shape language as the board:
 * square = flat, rotated bar = wall, circle = capstone; fill = owner.
 * Optionally renders a label (e.g. a count) centered on top of the shape.
 */
export function PieceGlyph({
  piece,
  size,
  label,
  dimmed,
}: {
  piece: Piece;
  size: number;
  label?: string;
  dimmed?: boolean;
}) {
  const fill = piece.player === 1 ? theme.p1 : theme.p2;
  const edge = piece.player === 1 ? theme.p1Edge : theme.p2Edge;
  const labelColor = piece.player === 1 ? '#2a2620' : theme.text;

  let shape;
  if (piece.type === 'C') {
    shape = (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderWidth: 2,
          borderColor: edge,
        }}
      />
    );
  } else if (piece.type === 'S') {
    shape = (
      <View
        style={{
          width: size * 0.38,
          height: size,
          borderRadius: 3,
          backgroundColor: fill,
          borderWidth: 2,
          borderColor: edge,
          transform: [{ rotate: '45deg' }],
        }}
      />
    );
  } else {
    shape = (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          backgroundColor: fill,
          borderWidth: 2,
          borderColor: edge,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dimmed ? 0.3 : 1,
      }}
    >
      {shape}
      {label != null && (
        <Text
          style={{
            position: 'absolute',
            color: labelColor,
            fontSize: Math.max(11, size * 0.42),
            fontWeight: '800',
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

export interface StackPickerItem {
  piece: Piece;
  /** count chosen when this piece is tapped; shown inside the piece */
  n: number;
  enabled: boolean;
}

/**
 * A row of stack pieces used to choose a pickup/drop count visually:
 * each piece shows whose it is and what it is, with the count it selects
 * rendered inside it. Disabled pieces are dimmed and untappable.
 */
export function StackPiecePicker({
  items,
  onPick,
  size = 44,
}: {
  items: StackPickerItem[];
  onPick: (n: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.row}>
      {items.map((it, i) => (
        <Pressable
          key={i}
          disabled={!it.enabled}
          onPress={() => onPick(it.n)}
          style={({ pressed }) => [
            styles.slot,
            it.enabled && styles.slotEnabled,
            pressed && { borderColor: theme.accent },
          ]}
        >
          <PieceGlyph
            piece={it.piece}
            size={size}
            label={it.enabled ? String(it.n) : undefined}
            dimmed={!it.enabled}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slot: {
    padding: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  slotEnabled: {
    backgroundColor: theme.surfaceHi,
    borderColor: theme.border,
  },
});
