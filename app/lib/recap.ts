import type { LeagueRoot } from './state';

// A recap's first line is the episode's title ("Permanent Uncertainty 🔥"),
// per the recap format. Split it off so the title can head the page and the
// list, and the rest reads as the body.
export function parseRecap(note: string | undefined): { title: string | null; body: string } {
  const text = (note ?? '').trim();
  if (!text) return { title: null, body: '' };
  const nl = text.indexOf('\n');
  const first = (nl === -1 ? text : text.slice(0, nl)).trim();
  // Treat it as a title only when it looks like one: short, and not a sentence.
  const looksLikeTitle = first.length > 0 && first.length <= 70 && !/[.!?:]$/.test(first.replace(/[\p{Extended_Pictographic}️\s]+$/u, ''));
  if (!looksLikeTitle) return { title: null, body: text };
  const title = first.replace(/[\s\p{Extended_Pictographic}️]+$/u, '').trim();
  return { title: title || null, body: nl === -1 ? '' : text.slice(nl + 1).trim() };
}

/** An episode's title and recap body: the saved title if there is one, else split off the recap's first line. */
export function recapParts(root: LeagueRoot, ep: number): { title: string | null; body: string } {
  const note = root.episodeNotes?.[String(ep)];
  const saved = root.episodeTitles?.[String(ep)]?.trim();
  if (saved) return { title: saved, body: (note ?? '').trim() };
  return parseRecap(note);
}
