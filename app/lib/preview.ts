import type { LeagueRoot } from './state';

// Simulator preview mode. Set EXPO_PUBLIC_PREVIEW=1 only when publishing to
// the `preview` channel (the local simulator build). It stands in for the
// parts that need a server we haven't set up yet:
//  - sign-in (Google / email code) is simulated: any 6-digit code works;
//  - league data comes from preview/league.json, a snapshot of the one-way
//    copy of the Outlast leagues (chat removed), instead of the database.
// Nothing is written anywhere in preview. Remove before any real release.
//
// EXPO_PUBLIC_PREVIEW=empty shows a brand-new user's view instead: the show's
// season data (cast, tribes, episodes) is there, because we provide it, but no
// leagues, players, picks or predictions exist yet.
const MODE = process.env.EXPO_PUBLIC_PREVIEW;
export const PREVIEW = MODE === '1' || MODE === 'empty';
export const PREVIEW_EMPTY = MODE === 'empty';

function load(): LeagueRoot | null {
  if (!PREVIEW) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const full = require('../preview/league.json') as LeagueRoot;
  if (!PREVIEW_EMPTY) return full;
  const { leagues: _l, predictions: _p, winnerPicks: _w, ...season } = full as LeagueRoot & Record<string, unknown>;
  return { ...(season as LeagueRoot), leagues: {} } as LeagueRoot;
}
export const previewRoot: LeagueRoot | null = load();
