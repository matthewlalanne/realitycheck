import { episodeAirTime } from './countdown';

// The shows and seasons a league can be built on. We keep each season's cast,
// schedule and results; commissioners just pick one.
export type Season = {
  /** Also the id stored on a league (e.g. 'survivor-51'). */
  id: string;
  label: string;
  detail?: string;
  /** When new episodes air, in the network's own time zone. */
  airs: { weekday: number; hour: number; minute: number; tz: string; tzLabel: string };
  /** One real airing, used to convert the slot into anyone's local time. */
  airAnchorUtc: number;
};

export type Show = {
  id: string;
  name: string;
  available: boolean;
  castNoun: string;
  groupNoun: string;
  seasons: Season[];
};

export const SHOWS: Show[] = [
  {
    id: 'survivor', name: 'Survivor', available: true, castNoun: 'castaways', groupNoun: 'tribes',
    seasons: [
      {
        id: 'survivor-51', label: 'Season 51', detail: 'Airing now · 21 castaways',
        airs: { weekday: 3, hour: 20, minute: 0, tz: 'America/New_York', tzLabel: 'Eastern' },
        airAnchorUtc: Date.UTC(2026, 8, 24, 0, 0), // Wed Sept 23, 8 PM EDT
      },
    ],
  },
  { id: 'traitors', name: 'The Traitors', available: false, castNoun: 'players', groupNoun: 'teams', seasons: [] },
  { id: 'big-brother', name: 'Big Brother', available: false, castNoun: 'houseguests', groupNoun: 'teams', seasons: [] },
  { id: 'amazing-race', name: 'The Amazing Race', available: false, castNoun: 'teams', groupNoun: 'legs', seasons: [] },
  { id: 'bachelor', name: 'The Bachelor', available: false, castNoun: 'contestants', groupNoun: 'groups', seasons: [] },
];

export function findSeason(seasonId: string): { show: Show; season: Season } | null {
  for (const show of SHOWS) {
    const season = show.seasons.find((s) => s.id === seasonId);
    if (season) return { show, season };
  }
  return null;
}

export function seasonLabel(seasonId: string): string {
  const f = findSeason(seasonId);
  return f ? `${f.show.name} · ${f.season.label}` : '';
}

const WEEK_MIN = 7 * 24 * 60;
const minuteOfWeek = (d: Date) => d.getDay() * 1440 + d.getHours() * 60 + d.getMinutes();

/** The air slot in this phone's time zone, as minute-of-week (Sun 00:00 = 0). */
export function localAirMinute(_season: Season): number {
  return minuteOfWeek(new Date(localAirUtc(_season)));
}

/** The first episode's air time as broadcast in this phone's time zone. */
export function localAirUtc(_season: Season): number {
  return episodeAirTime(1);
}

/** Minutes from air to a local weekday/time, wrapping around the week. */
export function minutesAfterAir(season: Season, weekday: number, hour: number, minute: number): number {
  const chosen = weekday * 1440 + hour * 60 + minute;
  return (chosen - localAirMinute(season) + WEEK_MIN) % WEEK_MIN;
}

export const REVEAL_MIN_HOURS = 12;

export function fmtLocalSlot(weekday: number, hour: number, minute: number, withZone = true): string {
  const d = new Date(2026, 8, 20 + weekday, hour, minute); // Sept 20 2026 is a Sunday
  const day = d.toLocaleDateString([], { weekday: 'long' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', ...(withZone ? { timeZoneName: 'short' } : {}) });
  return `${day} ${time}`;
}
