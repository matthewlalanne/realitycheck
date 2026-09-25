// Reality Check runs many shows and seasons side by side. Each season is its
// own record at `seasons/<seasonId>` with the same shape Outlast's single
// `league` record had (cast, tribes, results, leagues, picks, chat), so every
// screen that reads "the root" keeps working — it just reads the season of
// the league you've opened.
//
// Which season that is gets set once, before the league app mounts (App.tsx
// remounts the league app when it changes), so the path helpers here can be
// plain functions rather than something every hook has to subscribe to.

export type SeasonMeta = {
  showId: string;
  showName: string;
  /** e.g. "Season 39" */
  label: string;
  /** What one draftable pick is: a castaway, or an Amazing Race team of two. */
  unit: 'castaway' | 'team';
  /**
   * Episode -> broadcast wall-clock time in the network's ET/PT slot,
   * "YYYY-MM-DDTHH:MM". Central and Mountain see it an hour earlier, the way
   * network primetime works. Episodes past the list repeat weekly.
   */
  episodes: Record<string, string>;
  /** Survivor-only machinery that other shows don't have. */
  features?: { tribes?: boolean; idols?: boolean; stats?: boolean; recaps?: boolean };
};

let activeId = 'survivor-51';
let activeMeta: SeasonMeta | null = null;

export function setActiveSeason(id: string, meta: SeasonMeta | null) {
  activeId = id;
  activeMeta = meta;
}
export function activeSeasonId() {
  return activeId;
}
export function activeSeason(): SeasonMeta | null {
  return activeMeta;
}
/** The database path of the season currently open. */
export function seasonPath(): string {
  return `seasons/${activeId}`;
}

// ---- Words -------------------------------------------------------------------
// Everything a screen says about the cast goes through here, so a new show is
// a data change, not a hunt through every screen for "castaway".

export type Terms = {
  unit: string; // castaway / team
  units: string; // castaways / teams
  Unit: string;
  Units: string;
  /** Title of whoever wins the season. */
  winner: string;
  /** How someone leaves. */
  out: string; // voted out / eliminated
  episode: string; // Episode / Leg
  hasTribes: boolean;
  hasIdols: boolean;
  hasStats: boolean;
};

export function termsFor(meta: SeasonMeta | null | undefined): Terms {
  const team = meta?.unit === 'team';
  const survivor = !meta || meta.showId === 'survivor';
  return {
    unit: team ? 'team' : 'castaway',
    units: team ? 'teams' : 'castaways',
    Unit: team ? 'Team' : 'Castaway',
    Units: team ? 'Teams' : 'Castaways',
    winner: survivor ? 'Sole Survivor' : meta?.showId === 'amazing-race' ? 'race winner' : 'winner',
    out: survivor ? 'voted out' : 'eliminated',
    episode: 'Episode',
    hasTribes: meta ? !!meta.features?.tribes : true,
    hasIdols: meta ? !!meta.features?.idols : true,
    hasStats: meta ? !!meta.features?.stats : true,
  };
}
