import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  GameState,
  Move,
  Player,
  applyMove,
  createInitialState,
  deserializeState,
  serializeState,
} from '../engine';
import { Difficulty, chooseMove } from '../ai/ai';

const STORAGE_KEY = 'tak:session:v1';

export interface Session {
  state: GameState;
  difficulty: Difficulty;
  humanPlayer: Player;
  /** serialized snapshots taken before each human move, for undo */
  snapshots: string[];
}

interface PersistedSession {
  stateJson: string;
  difficulty: Difficulty;
  humanPlayer: Player;
  snapshots: string[];
}

interface GameStore {
  session: Session | null;
  aiThinking: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  newGame: (size: number, difficulty: Difficulty, humanFirst: boolean) => void;
  playHumanMove: (move: Move) => void;
  runAiTurnIfNeeded: () => Promise<void>;
  undo: () => void;
  clearGame: () => void;
}

async function persist(session: Session | null): Promise<void> {
  try {
    if (!session) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    const p: PersistedSession = {
      stateJson: serializeState(session.state),
      difficulty: session.difficulty,
      humanPlayer: session.humanPlayer,
      snapshots: session.snapshots,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // persistence is best-effort; never crash the game over it
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  session: null,
  aiThinking: false,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedSession;
        set({
          session: {
            state: deserializeState(p.stateJson),
            difficulty: p.difficulty,
            humanPlayer: p.humanPlayer,
            snapshots: p.snapshots ?? [],
          },
        });
      }
    } catch {
      // corrupt save: start fresh
    }
    set({ hydrated: true });
  },

  newGame: (size, difficulty, humanFirst) => {
    const session: Session = {
      state: createInitialState(size),
      difficulty,
      humanPlayer: humanFirst ? 1 : 2,
      snapshots: [],
    };
    set({ session, aiThinking: false });
    void persist(session);
  },

  playHumanMove: (move) => {
    const { session, aiThinking } = get();
    if (!session || aiThinking || session.state.result) return;
    if (session.state.currentPlayer !== session.humanPlayer) return;
    const snapshot = serializeState(session.state);
    const nextState = applyMove(session.state, move);
    const next: Session = {
      ...session,
      state: nextState,
      snapshots: [...session.snapshots, snapshot],
    };
    set({ session: next });
    void persist(next);
  },

  runAiTurnIfNeeded: async () => {
    const { session, aiThinking } = get();
    if (!session || aiThinking || session.state.result) return;
    if (session.state.currentPlayer === session.humanPlayer) return;
    set({ aiThinking: true });
    try {
      const move = await chooseMove(session.state, session.difficulty);
      const cur = get().session;
      // the session may have changed (new game / undo) while thinking
      if (!cur || serializeState(cur.state) !== serializeState(session.state)) {
        return;
      }
      const next: Session = { ...cur, state: applyMove(cur.state, move) };
      set({ session: next });
      void persist(next);
    } finally {
      set({ aiThinking: false });
    }
  },

  undo: () => {
    const { session, aiThinking } = get();
    if (!session || aiThinking || session.snapshots.length === 0) return;
    const snapshots = [...session.snapshots];
    const last = snapshots.pop()!;
    const next: Session = {
      ...session,
      state: deserializeState(last),
      snapshots,
    };
    set({ session: next });
    void persist(next);
  },

  clearGame: () => {
    set({ session: null, aiThinking: false });
    void persist(null);
  },
}));
