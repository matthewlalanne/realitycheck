import { useEffect, useState } from 'react';

import { activeSeason } from './season';

// Each season carries its own episode list (lib/season.ts): the broadcast
// wall-clock time in the ET/PT slot. Every player counts down to when it
// airs where their phone is — ET/PT at the listed time, Central and Mountain
// an hour earlier, the way network primetime works.
type Zone = { stdOffset: number; shift: number }; // UTC offset in standard time; hours vs the ET/PT slot
const DAY_MS = 24 * 60 * 60 * 1000;

const clock = () => Date.now();

// US daylight time runs from the 2nd Sunday of March to the 1st Sunday of
// November. Seasons cross Nov 1, so a flat 7-day step would drift an hour.
function nthSunday(y: number, m: number, n: number): number {
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}
function isDaylightTime(y: number, m: number, d: number): boolean {
  const day = Date.UTC(y, m, d);
  return day >= Date.UTC(y, 2, nthSunday(y, 2, 2)) && day < Date.UTC(y, 10, nthSunday(y, 10, 1));
}

function deviceZone(): Zone {
  const jan = new Date(new Date().getFullYear(), 0, 1);
  const std = -jan.getTimezoneOffset() / 60; // standard-time UTC offset
  if (std === -6) return { stdOffset: -6, shift: -1 };
  if (std === -7) return { stdOffset: -7, shift: -1 };
  if (std === -8) return { stdOffset: -8, shift: 0 };
  return { stdOffset: -5, shift: 0 }; // Eastern, and anywhere else follows the Eastern feed
}

// Survivor 51's schedule, for season records written before schedules lived
// in the database.
const FALLBACK_FIRST = '2026-09-23T20:00';

function slotFor(ep: number): { y: number; m: number; d: number; hh: number; mm: number } {
  const eps = activeSeason()?.episodes ?? {};
  const nums = Object.keys(eps).map(Number).filter((n) => n >= 1).sort((a, b) => a - b);
  let base = nums.length ? nums[0] : 1;
  let text = nums.length ? eps[String(nums[0])] : FALLBACK_FIRST;
  for (const n of nums) if (n <= ep) { base = n; text = eps[String(n)]; }
  const [date, time] = text.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '20:00').split(':').map(Number);
  // Episodes past the last listed one repeat weekly from it.
  const day = new Date(Date.UTC(y, m - 1, d) + (ep - base) * 7 * DAY_MS);
  return { y: day.getUTCFullYear(), m: day.getUTCMonth(), d: day.getUTCDate(), hh, mm };
}

// `_leagueKey` is kept so existing callers still compile; the schedule is per
// season now, and the time zone is the phone's.
export function episodeAirTime(ep: number, _leagueKey?: string): number {
  const z = deviceZone();
  const { y, m, d, hh, mm } = slotFor(ep);
  const offset = z.stdOffset + (isDaylightTime(y, m, d) ? 1 : 0);
  return Date.UTC(y, m, d, hh + z.shift - offset, mm);
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

export function pickDeadline(episode: number, leagueKey?: string): number {
  return episodeAirTime(episode, leagueKey) - 60 * 60 * 1000;
}

// The episode the Predictions tab is on: normally the upcoming one, but an
// extended deadline keeps the previous episode open past its air time.
export function predictionEpisodeNumber(leagueKey?: string): number {
  const ep = upcomingEpisodeNumber(leagueKey);
  return ep > 1 && clock() < pickDeadline(ep - 1, leagueKey) ? ep - 1 : ep;
}

// The season-winner pick locks with the premiere's weekly pick.
export function seasonPickClosed(leagueKey?: string): boolean {
  return clock() >= pickDeadline(1, leagueKey);
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
