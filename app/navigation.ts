import type { NavigatorScreenParams } from '@react-navigation/native';

// Central list of screens so every screen file shares the same param types.
// Splash and the "Who are you?" picker aren't here — RootNavigator renders
// them directly before the navigator exists.
export type RootStackParamList = {
  // Takes a tab so a notification tap can land on Messages.
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  // Pushed from Home — only reachable while a league's draft is pending/live.
  Draft: undefined;
  // Pushed from Cast (and anywhere else a castaway name/photo is tappable).
  Bio: { id: string };
  // Your private pre-draft ranking + notes. Pushed from Cast, a bio, or the
  // draft board itself.
  MyBoard: undefined;
  // Commissioner-only, pushed from Settings.
  EpisodeManager: undefined;
  // One episode at a time: eliminations + recap + publish.
  EpisodeEditor: { episode: number };
  // Commissioner-only, pushed from Settings: tribe names, colors, members.
  Tribes: undefined;
  // A published episode as a full page: facts up top, the recap below.
  EpisodeRecap: { episode: number };
  // A player's own page: roster status, rank/points, prediction record.
  // Pushed from Standings, chat, and the Predictions leaderboard.
  TeamProfile: { playerId: string };
};

export type MainTabParamList = {
  Standings: undefined;
  Cast: undefined;
  Predictions: undefined;
  Games: undefined;
  Messages: undefined;
  Settings: undefined;
};
