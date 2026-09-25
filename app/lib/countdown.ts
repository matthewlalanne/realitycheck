import { useEffect, useState } from 'react';

// Survivor premieres Wed Sept 23, 2026 and airs weekly after that. Each league
// counts down to when it actually watches: Mountain-time affiliates run
// primetime an hour earlier, so Denver and Colorado Springs see it at 7 PM MT.
// Porterville streams the East Coast feed live (5 PM PT), so it stays on the
// Eastern default along with any league not listed here.
type Zone = { stdOffset: number; hour: number }; // UTC offset in standard time
const EASTERN: Zone = { stdOffset: -5, hour: 20 };
const LEAGUE_ZONES: Record<string, Zone> = {
  denver: { stdOffset: -7, hour: 19 }, // 7 PM Mountain
  coloradoSprings: { stdOffset: -7, hour: 19 }, // 7 PM Mountain
};

const PREMIERE = { y: 2026, m: 8, d: 23 }; // local calendar date, month 0-based
const DAY_MS = 24 * 60 * 60 * 1000;

const clock = () => Date.now();

// US daylight time runs from the 2nd Sunday of March to the 1st Sunday of
// November. The season crosses Nov 1, so a flat 7-day step would drift an hour.
function nthSunday(y: number, m: number, n: number): number {
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}
function isDaylightTime(y: number, m: number, d: number): boolean {
  const day = Date.UTC(y, m, d);
  return day >= Date.UTC(y, 2, nthSunday(y, 2, 2)) && day < Date.UTC(y, 10, nthSunday(y, 10, 1));
}

// Confessional: each player's picks lock on their own phone's time zone, using
// the network's local broadcast slot there. Primetime runs 8 PM Eastern and
// Pacific, 7 PM Central and Mountain; anywhere else follows the Eastern feed.
function deviceZone(): Zone {
  const jan = new Date(new Date().getFullYear(), 0, 1);
  const std = -jan.getTimezoneOffset() / 60; // standard-time UTC offset
  if (std === -5) return { stdOffset: -5, hour: 20 };
  if (std === -6) return { stdOffset: -6, hour: 19 };
  if (std === -7) return { stdOffset: -7, hour: 19 };
  if (std === -8) return { stdOffset: -8, hour: 20 };
  return EASTERN;
}

function zoneFor(leagueKey?: string): Zone {
  return (leagueKey && LEAGUE_ZONES[leagueKey]) || deviceZone();
}

export function episodeAirTime(ep: number, leagueKey?: string): number {
  const z = zoneFor(leagueKey);
  const local = new Date(Date.UTC(PREMIERE.y, PREMIERE.m, PREMIERE.d) + (ep - 1) * 7 * DAY_MS);
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  const offset = z.stdOffset + (isDaylightTime(y, m, d) ? 1 : 0);
  return Date.UTC(y, m, d, z.hour - offset);
}

// The episode number currently being counted down to (1 = premiere) — also
// used elsewhere as the "current week" key for predictions.
export function upcomingEpisodeNumber(leagueKey?: string): number {
  const now = clock();
  let ep = 1;
  while (episodeAirTime(ep, leagueKey) <= now) ep++;
  return ep;
}

// Episodes 1..airedEpisodeCount() have aired and are eligible for the
// commissioner's episode editor; the next one is still locked/upcoming.
export function airedEpisodeCount(leagueKey?: string): number {
  return upcomingEpisodeNumber(leagueKey) - 1;
}

// Commissioner extensions to a pick deadline, by league and episode (UTC ms).
// Porterville's premiere picks (weekly + season) stayed open until 6 PM PT.
const PICK_DEADLINE_OVERRIDES: Record<string, Record<number, number>> = {
  porterville: { 1: Date.UTC(2026, 8, 24, 1) }, // Sept 23, 6 PM PDT
};

export function pickDeadline(episode: number, leagueKey?: string): number {
  const override = leagueKey ? PICK_DEADLINE_OVERRIDES[leagueKey]?.[episode] : undefined;
  return override ?? episodeAirTime(episode, leagueKey) - 60 * 60 * 1000;
}

// The episode the Predictions tab is on: normally the upcoming one, but an
// extended deadline keeps the previous episode open past its air time.
export function predictionEpisodeNumber(leagueKey?: string): number {
  const ep = upcomingEpisodeNumber(leagueKey);
  return ep > 1 && clock() < pickDeadline(ep - 1, leagueKey) ? ep - 1 : ep;
}

// The season (Sole Survivor) pick normally locks with the premiere's weekly
// pick, but can be extended on its own without reopening episode 1.
const SEASON_PICK_DEADLINE: number | null = Date.UTC(2026, 8, 24, 3); // Sept 23, 9 PM MDT, all leagues

export function seasonPickClosed(leagueKey?: string): boolean {
  return clock() >= (SEASON_PICK_DEADLINE ?? pickDeadline(1, leagueKey));
}

// Predictions lock 1 hour before air (matches the website) — hides everyone
// else's actual pick until then so nobody can copy a late submission.
export function predictionsClosed(episode: number, leagueKey?: string): boolean {
  return clock() >= pickDeadline(episode, leagueKey);
}

function fmtCountdown(leagueKey?: string): { label: string; clock: string } {
  const ep = upcomingEpisodeNumber(leagueKey);
  const diff = Math.max(0, episodeAirTime(ep, leagueKey) - clock());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const label = ep === 1 ? 'Season premiere in' : `Episode ${ep} in`;
  return { label, clock: `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` };
}

export function useEpisodeCountdown(leagueKey?: string) {
  const [state, setState] = useState(() => fmtCountdown(leagueKey));

  useEffect(() => {
    setState(fmtCountdown(leagueKey));
    const id = setInterval(() => setState(fmtCountdown(leagueKey)), 1000);
    return () => clearInterval(id);
  }, [leagueKey]);

  return state;
}
