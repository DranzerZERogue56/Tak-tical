# Tak-tical

An offline mobile game of **Tak** (the 2-player abstract strategy game by James Ernest and Patrick Rothfuss) — play against an AI opponent. Built with React Native / Expo (TypeScript). No accounts, no network, no ads.

## 📲 Install on Android

Grab the APK from the [**latest release**](../../releases/latest), open it on your phone, and allow the install when Android asks ("Install unknown apps"). Android will warn that the app is unsigned/debug-signed — that's expected for a sideloaded build.

### Updating from an older version

If you already have an older APK installed:

1. Download the new APK from the [latest release](../../releases/latest) and open it — Android installs it **over** the old version, keeping your saved game and settings. No need to uninstall first.
2. If Android refuses with "App not installed" or a signature error, the new APK was signed with a different key than your old one. Uninstall the old app first (this discards any in-progress game), then install the new APK.
3. Saved games from older versions load fine; they just default to the new **Balanced** AI style. Start a new game to pick a style or the new **expert** difficulty.

If you build from source instead, pull the latest and rebuild (see [Building the APK](#building-the-apk)):

```bash
git pull
npm install
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

## Features

- Full official US Tak rules: board sizes 3×3–8×8, first-turn opponent-flat rule, stack moves with carry limits, walls, capstone flattening, road wins (including the dragon clause), flat wins, draws
- Four AI difficulties — easy (heuristic random), medium/hard/expert (alpha-beta search with iterative deepening and blunder avoidance, ~1–3 s per move)
- Four AI styles for medium and up — Balanced, Aggressor (stack hunter), Roadrunner (road racer), Fortress (defensive)
- Guided touch interface: only legal moves are ever offered
- PTN (Portable Tak Notation) move log with share/export
- Stack inspector, undo, road-win highlight, rules reference
- Close the app any time — your game resumes where you left off

## Development

```bash
npm install
npm test          # Jest tests over the rules engine and AI
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
