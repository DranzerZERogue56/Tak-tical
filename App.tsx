import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useGameStore } from './src/store/gameStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { theme } from './src/theme';

type Screen = 'home' | 'game' | 'rules';

export default function App() {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);
  const [screen, setScreen] = useState<Screen>('home');
  const [rulesFrom, setRulesFrom] = useState<Screen>('home');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const openRules = (from: Screen) => {
    setRulesFrom(from);
    setScreen('rules');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="light" />
      {hydrated && screen === 'home' && (
        <HomeScreen onPlay={() => setScreen('game')} onRules={() => openRules('home')} />
      )}
      {hydrated && screen === 'game' && (
        <GameScreen onExit={() => setScreen('home')} onRules={() => openRules('game')} />
      )}
      {hydrated && screen === 'rules' && (
        <RulesScreen onBack={() => setScreen(rulesFrom)} />
      )}
    </View>
  );
}
