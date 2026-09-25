import type { EpisodeStat, LeagueRoot, RemoteContestant } from './state';

// What each castaway did, episode by episode — immunity, idols, votes — so the
// league can see who's actually playing, not just who's still in. Entered by
// the commissioner in the episode editor and published with the recap, so it
// never shows up before the episode's results do.
//
// Stored as league/episodeStats/{ep}/{contestantId}. Totals are always
// computed from those rows rather than kept as running counts, so correcting
// an old episode fixes every total at once.

export type SeasonStats = {
  immunity: number;
  reward: number;
  journeys: number;
  idolsFound: number;
  idolPlays: number;
  idolSaves: number;
  votes: number;
};

const EMPTY: SeasonStats = { immunity: 0, reward: 0, journeys: 0, idolsFound: 0, idolPlays: 0, idolSaves: 0, votes: 0 };

export function statFor(root: LeagueRoot, ep: number, contestantId: string): EpisodeStat {
  return root.episodeStats?.[String(ep)]?.[contestantId] ?? {};
}

export function seasonStatsFor(root: LeagueRoot, contestantId: string): SeasonStats {
  const t = { ...EMPTY };
  Object.values(root.episodeStats ?? {}).forEach((byCastaway) => {
    const s = byCastaway?.[contestantId];
    if (!s) return;
    if (s.immunity) t.immunity++;
    if (s.reward) t.reward++;
    if (s.journey) t.journeys++;
    if (s.idolFound) t.idolsFound++;
    if (s.idolPlay) t.idolPlays++;
    if (s.idolPlay === 'saved') t.idolSaves++;
    t.votes += s.votes ?? 0;
  });
  return t;
}

/** The season totals on every bio, always the same six in the same order — zeros included, so bios compare at a glance. */
export function statTiles(s: SeasonStats): { value: number; label: string }[] {
  const t = [
    { value: s.votes, label: s.votes === 1 ? 'Vote against' : 'Votes against' },
    { value: s.immunity, label: s.immunity === 1 ? 'Immunity win' : 'Immunity wins' },
    { value: s.idolsFound, label: s.idolsFound === 1 ? 'Idol found' : 'Idols found' },
    // Times an idol they played cancelled votes that would have sent them home.
    { value: s.idolSaves, label: 'Saved by idol' },
    { value: s.reward, label: s.reward === 1 ? 'Reward win' : 'Reward wins' },
    { value: s.journeys, label: s.journeys === 1 ? 'Journey' : 'Journeys' },
  ];
  return t;
}

/** How many idols they're holding right now. */
export function idolCount(items: Record<string, { kind: string }> | undefined): number {
  return Object.values(items ?? {}).filter((h) => h && /idol/i.test(h.kind)).length;
}

/** One line per notable thing in an episode, for the Episode Summary on Home. */
export type Highlight = { label: string; text: string };

export function episodeHighlights(root: LeagueRoot, ep: number, nameOf: (id: string) => string): Highlight[] {
  const rows = root.episodeStats?.[String(ep)] ?? {};
  const lines: Highlight[] = [];
  const who = (pred: (s: EpisodeStat) => boolean) =>
    Object.entries(rows).filter(([, s]) => s && pred(s)).map(([id]) => nameOf(id));

  // Whole tribe won? Say the tribe, not ten names.
  const tribeWins = (field: 'immunity' | 'reward') => {
    const winners = new Set(Object.entries(rows).filter(([, s]) => s?.[field]).map(([id]) => id));
    if (!winners.size) return null;
    const tribes = Object.entries(root.tribes ?? {});
    for (const [tid, t] of tribes) {
      const members = (root.contestants ?? []).filter((c) => c && c.tribe === tid && !(c.eliminatedWeek && c.eliminatedWeek < ep));
      if (members.length > 1 && members.every((m) => winners.has(m.id)) && winners.size === members.length) {
        return t.name;
      }
    }
    return null;
  };

  const immTribe = tribeWins('immunity');
  const imm = who((s) => !!s.immunity);
  if (immTribe) lines.push({ label: 'Immunity', text: immTribe });
  else if (imm.length) lines.push({ label: 'Immunity', text: imm.join(', ') });

  const rewTribe = tribeWins('reward');
  const rew = who((s) => !!s.reward);
  if (rewTribe) lines.push({ label: 'Reward', text: rewTribe });
  else if (rew.length) lines.push({ label: 'Reward', text: rew.join(', ') });

  const found = who((s) => !!s.idolFound);
  if (found.length) lines.push({ label: 'Idol found', text: found.join(', ') });
  const saved = who((s) => s.idolPlay === 'saved');
  if (saved.length) lines.push({ label: 'Saved by idol', text: saved.join(', ') });
  const wasted = who((s) => s.idolPlay === 'wasted');
  if (wasted.length) lines.push({ label: 'Idol played', text: wasted.join(', ') });
  const journeys = who((s) => !!s.journey);
  if (journeys.length) lines.push({ label: 'Journey', text: journeys.join(', ') });

  const votes = Object.entries(rows)
    .filter(([, s]) => s?.votes)
    .sort((a, b) => (b[1].votes ?? 0) - (a[1].votes ?? 0))
    .map(([id, s]) => `${nameOf(id)} ${s.votes}`);
  if (votes.length) lines.push({ label: 'The vote', text: votes.join(', ') });

  if (root.game?.mergeEp === ep) lines.push({ label: 'Milestone', text: 'The tribes merged' });
  if (root.game?.juryEp === ep) lines.push({ label: 'Milestone', text: 'The jury began' });
  return lines;
}

export type Stage = 'merged' | 'jury' | null;

/** MERGED for anyone still in once the merge has happened; JURY for anyone voted out from the jury start on. */
export function stageOf(root: LeagueRoot, c: Pick<RemoteContestant, 'eliminatedWeek'>): Stage {
  const { mergeEp, juryEp } = root.game ?? {};
  if (c.eliminatedWeek) return juryEp && c.eliminatedWeek >= juryEp ? 'jury' : null;
  return mergeEp ? 'merged' : null;
}

export function sanitizeStat(s: EpisodeStat): EpisodeStat | null {
  const out: EpisodeStat = {};
  if (s.immunity) out.immunity = true;
  if (s.reward) out.reward = true;
  if (s.journey) out.journey = true;
  if (s.idolFound) out.idolFound = true;
  if (s.idolPlay) out.idolPlay = s.idolPlay;
  if (s.votes && s.votes > 0) out.votes = Math.min(30, Math.round(s.votes));
  return Object.keys(out).length ? out : null;
}
