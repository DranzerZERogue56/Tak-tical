# Tak-tical

An offline mobile game of **Tak** (the 2-player abstract strategy game by James Ernest and Patrick Rothfuss) — play against an AI opponent. Built with React Native / Expo (TypeScript). No accounts, no network, no ads.

## 📲 Install on Android

Grab the APK from the [**latest release**](../../releases/latest), open it on your phone, and allow the install when Android asks ("Install unknown apps"). Android will warn that the app is unsigned/debug-signed — that's expected for a sideloaded build.

## Features

- Full official US Tak rules: board sizes 3×3–8×8, first-turn opponent-flat rule, stack moves with carry limits, walls, capstone flattening, road wins (including the dragon clause), flat wins, draws
- Three AI difficulties — easy (heuristic random), medium/hard (alpha-beta search, ~1.5 s per move)
- Guided touch interface: only legal moves are ever offered
- PTN (Portable Tak Notation) move log with share/export
- Stack inspector, undo, road-win highlight, rules reference
- Close the app any time — your game resumes where you left off

## Development

```bash
npm install
npm test          # 57 Jest tests over the rules engine and AI
npx expo start    # run in Expo Go
```

The rules live in a pure, UI-independent engine (`src/engine/`) exposing `getLegalMoves` / `applyMove` / `getResult` plus PTN serialization. The AI (`src/ai/`) and UI only ever talk to the game through that API.

### Building the APK

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
