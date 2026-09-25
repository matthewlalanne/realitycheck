import type { LeagueRoot } from './state';

// Points scoring for "Points" leagues. Built only from what the recap already
// records each episode (lib/seasonStats.ts): immunity, reward, journeys, idols
// found/played, votes against, what they're holding, eliminations, merge.
// One table so it's easy to tune; commissioners may get to edit it later.
export const POINTS = {
  survived: 2,            // made it through the episode
  tribeImmunity: 2,       // pre-merge: their tribe won immunity
  individualImmunity: 6,  // post-merge: won the necklace
  tribeReward: 1,
  individualReward: 2,
  journey: 1,
  idolFound: 4,
  idolHeldPerEpisode: 1,  // each episode survived while still holding an idol
  idolSaved: 8,           // played it and it cancelled votes that would have sent them home
  idolWasted: -2,         // played it and nobody voted for them
  advantageFound: 2,      // extra vote, steal a vote, etc.
  votesAgainst: -1,       // per vote cast against them (max -3 an episode)
  votesAgainstCap: -3,
  madeMerge: 5,
  madeJury: 3,
  finalThree: 10,   // voted out (or eliminated at fire) in the finale episode itself
  winner: 20,       // the one castaway with no eliminatedWeek once the season is over
  quitOrMedical: -10,
};

export type PointLine = { ep: number; label: string; points: number };

export function pointsFor(root: LeagueRoot, castId: string): { total: number; lines: PointLine[] } {
  const lines: PointLine[] = [];
  const c = root.contestants?.find((x) => x?.id === castId);
  if (!c) return { total: 0, lines };
  const out = c.eliminatedWeek ?? null;
  const cast = (root.contestants ?? []).filter((x): x is NonNullable<typeof x> => !!x);
  const stillIn = cast.filter((x) => x.eliminatedWeek == null);
  const seasonOver = stillIn.length === 1; // exactly one castaway left standing = the finale has happened
  const isWinner = seasonOver && !out;
  const finaleEp = seasonOver ? Math.max(0, ...cast.map((x) => x.eliminatedWeek ?? 0)) : null;
  const isFinalThree = seasonOver && out !== null && out === finaleEp && !isWinner;
  const mergeEp = root.game?.mergeEp ?? null;
  const juryEp = root.game?.juryEp ?? null;
  const add = (ep: number, label: string, points: number) => { if (points) lines.push({ ep, label, points }); };

  const eps = Object.keys(root.episodeStats ?? {}).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  const lastEp = Math.max(0, ...eps, out ?? 0);
  const items = Object.values(c.items ?? {});

  for (let ep = 1; ep <= lastEp; ep++) {
    if (out && ep > out) break;
    const s = root.episodeStats?.[String(ep)]?.[castId] ?? {};
    const merged = !!mergeEp && ep >= mergeEp;
    if (!out || ep < out) add(ep, 'Survived the episode', POINTS.survived);
    if (s.immunity) add(ep, merged ? 'Won individual immunity' : 'Tribe won immunity', merged ? POINTS.individualImmunity : POINTS.tribeImmunity);
    if (s.reward) add(ep, merged ? 'Won reward' : 'Tribe won reward', merged ? POINTS.individualReward : POINTS.tribeReward);
    if (s.journey) add(ep, 'Went on a journey', POINTS.journey);
    if (s.idolFound) add(ep, 'Found an idol', POINTS.idolFound);
    if (s.idolPlay === 'saved') add(ep, 'Idol saved them', POINTS.idolSaved);
    if (s.idolPlay === 'wasted') add(ep, 'Played an idol nobody needed', POINTS.idolWasted);
    // A quit/medical exit wasn't a real vote, so it doesn't score as votes against.
    const isExitEp = out === ep && c.exitReason === 'quit';
    if (s.votes && !isExitEp) add(ep, `${s.votes} vote${s.votes > 1 ? 's' : ''} against`, Math.max(POINTS.votesAgainstCap, s.votes * POINTS.votesAgainst));
    // Holding: any idol found on or before this episode that's still held now.
    const held = items.filter((h) => /idol/i.test(h.kind) && h.ep <= ep).length;
    if (held && (!out || ep < out)) add(ep, 'Kept an idol hidden', held * POINTS.idolHeldPerEpisode);
    items.filter((h) => !/idol/i.test(h.kind) && h.ep === ep).forEach((h) => add(ep, `Found: ${h.kind}`, POINTS.advantageFound));
    if (mergeEp === ep && (!out || out >= ep)) add(ep, 'Made the merge', POINTS.madeMerge);
  }
  if (out && juryEp && out >= juryEp) add(out, 'Made the jury', POINTS.madeJury);

  // Derived automatically once the season is over — no separate marking needed.
  if (out && c.exitReason === 'quit') add(out, 'Left the game (quit / medical)', POINTS.quitOrMedical);
  if (isWinner && finaleEp) add(finaleEp, 'Won the season', POINTS.winner);
  if (isFinalThree && finaleEp) add(finaleEp, 'Made the Final 3', POINTS.finalThree);

  return { total: lines.reduce((n, l) => n + l.points, 0), lines };
}
