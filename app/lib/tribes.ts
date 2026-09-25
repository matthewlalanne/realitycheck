import { ref, update } from 'firebase/database';
import { rtdb } from './firebase';
import { seasonPath } from './season';
import { LIMITS, clamp } from './limits';
import type { LeagueRoot, Tribe } from './state';

// Tribes are set up by the commissioner after the premiere reveals them —
// the show doesn't announce names or colors ahead of time. Each castaway
// points at a tribe id, so renaming or recoloring a tribe is one write and
// every castaway on it follows.

// Offered as swatches in the editor. Survivor tribes are almost always one
// strong buff color, so a fixed set beats a free-form picker on a phone.
export const TRIBE_COLORS = [
  '#F2C230', // yellow
  '#8E5BD6', // purple
  '#E0463A', // red
  '#3B82F6', // blue
  '#2FA36B', // green
  '#F28C28', // orange
  '#1FB5B0', // teal
  '#E9579B', // pink
  '#8B5A2B', // brown
  '#9AA0A6', // grey
];

export type TribeEntry = Tribe & { id: string };

export function tribesOf(root: LeagueRoot): TribeEntry[] {
  return Object.entries(root.tribes ?? {})
    .filter(([, t]) => t && t.name)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function tribeOf(root: LeagueRoot, contestantId: string): TribeEntry | null {
  const tid = root.contestants?.find((c) => c && c.id === contestantId)?.tribe;
  const t = tid ? root.tribes?.[tid] : null;
  return tid && t ? { id: tid, ...t } : null;
}

export function saveTribe(id: string, tribe: Tribe) {
  return update(ref(rtdb, seasonPath()), {
    [`tribes/${id}`]: { name: clamp(tribe.name.trim() || 'Tribe', LIMITS.tribeName), color: tribe.color },
  });
}

export function addTribe(root: LeagueRoot) {
  const used = new Set(tribesOf(root).map((t) => t.color));
  const color = TRIBE_COLORS.find((c) => !used.has(c)) ?? TRIBE_COLORS[0];
  return saveTribe(`t${Date.now().toString(36)}`, { name: 'New tribe', color });
}

// Removing a tribe also takes everyone off it, in the same write, so no
// castaway is left pointing at a tribe that no longer exists.
export function removeTribe(root: LeagueRoot, id: string) {
  const patch: Record<string, null> = { [`tribes/${id}`]: null };
  (root.contestants ?? []).forEach((c, i) => {
    if (c && c.tribe === id) patch[`contestants/${i}/tribe`] = null;
  });
  return update(ref(rtdb, seasonPath()), patch);
}

// Writes only that castaway's own field, found by array index — never the
// whole contestants list (same reasoning as setElimination in episodes.ts).
export function setContestantTribe(root: LeagueRoot, contestantId: string, tribeId: string | null) {
  const idx = (root.contestants ?? []).findIndex((c) => c && c.id === contestantId);
  if (idx < 0) return Promise.resolve();
  return update(ref(rtdb, seasonPath()), { [`contestants/${idx}/tribe`]: tribeId });
}

// Dark text on light buffs (yellow), white on dark ones (purple).
export function textOnTribe(color: string): string {
  const n = parseInt(color.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1a1a1a' : '#ffffff';
}

// WCAG contrast ratio between a hex color and plain white or near-black.
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * One text color for a whole row of tribe chips, so the names don't switch
 * between white and black chip to chip. Picks whichever of the two stays most
 * readable on the worst-case chip.
 */
export function sharedTextOnTribes(colors: string[]): string {
  const DARK = '#1a1a1a';
  const lums = colors.map(luminance);
  const worst = (text: number) => Math.min(...lums.map((l) => contrast(l, text)));
  return worst(luminance(DARK)) >= worst(1) ? DARK : '#ffffff';
}
