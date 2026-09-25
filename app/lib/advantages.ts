import type { LeagueRoot } from './state';

// Idols and advantages a castaway is currently holding. The commissioner sets
// them in the episode editor alongside the recap, and they publish with it —
// so nobody sees who found what before the episode's recap is out.
//
// Stored per castaway as contestants[i].items: itemId -> { kind, ep }, where
// `ep` is the episode it was found in. Played or lost ones are simply removed.
export type Holding = { kind: string; ep: number };
export type Holdings = Record<string, Holding>;

// Offered as one-tap choices. Plain labels rather than an enum so the website
// and the app render them the same way without a lookup table.
export const HOLDING_KINDS = ['Idol', 'Extra vote', 'Steal a vote', 'Block a vote', 'Advantage'] as const;
export const HOLDING_KIND_MAX = 30; // mirrored in database.rules.json

export const isIdol = (kind: string) => kind.toLowerCase().includes('idol');

export function holdingsOf(root: LeagueRoot, contestantId: string): Holdings {
  return root.contestants?.find((c) => c && c.id === contestantId)?.items ?? {};
}

/** Oldest find first, so the order doesn't shuffle as more are added. */
export function holdingList(h: Holdings | undefined): (Holding & { id: string })[] {
  return Object.entries(h ?? {})
    .filter(([, v]) => v && v.kind)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => a.ep - b.ep || a.id.localeCompare(b.id));
}

let seq = 0;
export function newHoldingId() {
  seq += 1;
  return `h${Date.now().toString(36)}${seq}`;
}

/**
 * Paths to write for every castaway whose holdings were edited, keyed by
 * their index in the live record — only those castaways' own `items` node,
 * never the whole list.
 */
export function holdingsPatch(root: LeagueRoot, edited: Record<string, Holdings>): Record<string, Holdings | null> {
  const patch: Record<string, Holdings | null> = {};
  (root.contestants ?? []).forEach((c, idx) => {
    if (!c || !(c.id in edited)) return;
    const next = edited[c.id];
    if (JSON.stringify(next) === JSON.stringify(c.items ?? {})) return;
    patch[`contestants/${idx}/items`] = Object.keys(next).length ? next : null;
  });
  return patch;
}
