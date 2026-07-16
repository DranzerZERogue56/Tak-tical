import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/common';
import { theme, fontSizes } from '../theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Goal',
    body:
      'Connect two opposite edges of the board with an unbroken path of your flat stones and capstones — a road. Roads may bend, but only orthogonal (not diagonal) connections count. Corner squares belong to both adjacent edges.',
  },
  {
    title: 'Pieces',
    body:
      'Flat stone: lies flat, counts toward roads and the flat count.\n' +
      'Standing stone (wall): stood on edge. It blocks other pieces but does NOT count toward roads or the flat count.\n' +
      'Capstone: counts toward roads, cannot be stacked upon, and can flatten walls. Piece counts per player — 3×3: 10 flats; 4×4: 15; 5×5: 21 + 1 capstone; 6×6: 30 + 1; 7×7: 40 + 2; 8×8: 50 + 2.',
  },
  {
    title: 'First turn',
    body:
      "On each player's very first turn, they place one of the OPPONENT'S flat stones (flat only) on any empty square.",
  },
  {
    title: 'On your turn',
    body:
      'Do exactly one of the following:\n\n' +
      'PLACE a piece from your reserve on any empty square — as a flat, a wall, or a capstone.\n\n' +
      'MOVE a stack you control (your piece on top). Pick up 1 to carry-limit pieces from the top (carry limit = board size), move in a straight orthogonal line, and drop at least one piece on every square you enter, in the order they were picked up. Drops land on top of whatever is already there.',
  },
  {
    title: 'Walls & capstones',
    body:
      'Nothing may be dropped on a wall or a capstone — walls block movement. Exception: a capstone moving ALONE (the only piece dropped on that square, as the final square of its move) flattens a wall into a flat stone and lands on top of it.',
  },
  {
    title: 'Winning',
    body:
      'Road win: the moment a player connects two opposite edges with flats/capstones, they win. If one move completes roads for BOTH players, the player who made the move wins (the "dragon clause").\n\n' +
      'Flat win: if the board fills up, or either player places their last piece, the game ends immediately. The player with more flat stones on top of stacks wins; a tie is a draw.',
  },
  {
    title: 'In this app',
    body:
      'Tap an empty square to place a piece. Tap your own stack to move it: choose how many to pick up, then tap squares in a line, choosing how many to drop on each — only legal choices are offered. Tap an opponent stack to inspect its full composition. Undo reverts your last move (and the AI reply).',
  },
];

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How to play Tak</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.heading}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
      <Button label="Back" kind="secondary" onPress={onBack} style={{ marginBottom: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  title: {
    color: theme.text,
    fontSize: fontSizes.h1,
    fontWeight: '700',
    marginBottom: 14,
  },
  section: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  heading: {
    color: theme.accent,
    fontSize: fontSizes.h2,
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    color: theme.text,
    fontSize: fontSizes.body,
    lineHeight: 22,
  },
});
