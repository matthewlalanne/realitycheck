import { POINTS, pointsFor } from './points';
import {
  isEliminated, predictionLeaderboard, rosterIds, soleSurvivorId,
  type LeagueRecord, type LeagueRoot, type Player, type RemoteContestant,
} from './state';

export type RankedPlayer = Player & {
  roster: RemoteContestant[];
  alive: number;
  winner: boolean;
  points: number;
  predictionPoints: number;
  rank: number; // 1-based position in this list
};

/**
 * Single source of truth for "who's winning": Standings, the team profile
 * screen, and anywhere else that needs a player's rank/points compute it the
 * same way here instead of drifting apart re-implementing the sort.
 */
export function rankedStandings(root: LeagueRoot, lg: LeagueRecord, leagueKey: string): RankedPlayer[] {
  const contestants = root.contestants || [];
  const byId = new Map(contestants.filter(Boolean).map((c) => [c.id, c]));
  const winnerId = soleSurvivorId(root);
  const isPointsLeague = lg.style === 'points';
  // Opt-in only — see LeagueRecord.countPredictions.
  const countPreds = isPointsLeague && !!lg.countPredictions;
  const predWins = countPreds
    ? new Map(predictionLeaderboard(root, leagueKey).map((t) => [t.id, t.wins]))
    : null;

  const withScores = lg.players.map((p) => {
    const roster = rosterIds(lg, p.id).map((cid) => byId.get(cid)).filter(Boolean) as RemoteContestant[];
    const alive = roster.filter((c) => !isEliminated(c)).length;
    const winner = !!winnerId && roster.some((c) => c.id === winnerId);
    // Points leagues score every roster member every episode (lib/points.ts);
    // last-standing leagues only ever cared about who's still in.
    const rosterPoints = isPointsLeague ? roster.reduce((n, c) => n + pointsFor(root, c.id).total, 0) : 0;
    const predictionPoints = (predWins?.get(p.id) ?? 0) * POINTS.predictionCorrect;
    const points = rosterPoints + predictionPoints;
    return { ...p, roster, alive, winner, points, predictionPoints };
  });

  withScores.sort((a, b) => isPointsLeague
    ? b.points - a.points || a.name.localeCompare(b.name)
    : Number(b.winner) - Number(a.winner) || b.alive - a.alive || a.name.localeCompare(b.name));

  return withScores.map((p, i) => ({ ...p, rank: i + 1 }));
}
