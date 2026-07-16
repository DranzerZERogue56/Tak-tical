import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BotStyle, Difficulty } from '../ai/ai';
import { useGameStore } from '../store/gameStore';
import { Button, SegmentPicker } from '../components/common';
import { theme, fontSizes } from '../theme';

export function HomeScreen({
  onPlay,
  onRules,
}: {
  onPlay: () => void;
  onRules: () => void;
}) {
  const session = useGameStore((s) => s.session);
  const newGame = useGameStore((s) => s.newGame);
  const clearGame = useGameStore((s) => s.clearGame);

  const [size, setSize] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [style, setStyle] = useState<BotStyle>('balanced');
  const [humanFirst, setHumanFirst] = useState<'you' | 'ai'>('you');

  const hasGame = session !== null && session.state.result === null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TAK</Text>
      <Text style={styles.subtitle}>A Beautiful Game</Text>

      {hasGame && (
        <View style={styles.resumeCard}>
          <Text style={styles.resumeText}>
            Game in progress — {session!.state.size}×{session!.state.size},{' '}
            {session!.difficulty} {session!.style} AI
          </Text>
          <Button label="Resume game" onPress={onPlay} />
        </View>
      )}

      <View style={styles.form}>
        <Text style={styles.label}>Board size</Text>
        <SegmentPicker
          options={[3, 4, 5, 6, 7, 8]}
          value={size}
          onChange={setSize}
        />

        <Text style={styles.label}>AI difficulty</Text>
        <SegmentPicker
          options={['easy', 'medium', 'hard', 'expert'] as Difficulty[]}
          value={difficulty}
          onChange={setDifficulty}
        />

        {difficulty !== 'easy' && (
          <>
            <Text style={styles.label}>AI style</Text>
            <SegmentPicker
              options={
                ['balanced', 'aggressor', 'roadrunner', 'fortress'] as BotStyle[]
              }
              value={style}
              onChange={setStyle}
            />
          </>
        )}

        <Text style={styles.label}>Who goes first</Text>
        <SegmentPicker
          options={['you', 'ai'] as const}
          value={humanFirst}
          onChange={setHumanFirst}
          labels={(v) => (v === 'you' ? 'You' : 'AI')}
        />

        <Button
          label={hasGame ? 'Start new game (discards current)' : 'Start game'}
          onPress={() => {
            if (hasGame) clearGame();
            newGame(size, difficulty, humanFirst === 'you', style);
            onPlay();
          }}
          style={{ marginTop: 22 }}
        />
        <Button
          label="How to play"
          kind="secondary"
          onPress={onRules}
          style={{ marginTop: 10 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    color: theme.accent,
    fontSize: 52,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 14,
  },
  subtitle: {
    color: theme.textDim,
    fontSize: fontSizes.body,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 26,
  },
  resumeCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.accentDim,
  },
  resumeText: {
    color: theme.text,
    fontSize: fontSizes.body,
    textAlign: 'center',
  },
  form: {
    gap: 8,
  },
  label: {
    color: theme.textDim,
    fontSize: fontSizes.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
  },
});
