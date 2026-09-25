// Chat messages are stored as plain text, so links have to be found after the
// fact before a bubble can make them tappable.
//
// Deliberately conservative: a scheme or a `www.` prefix always counts, and a
// bare domain (`youtu.be/x`) only counts against a short list of TLDs people
// actually paste. A missed link is a copy away; a false positive turns
// ordinary trash talk blue and opens a browser on a tap.
export type MessagePart = { text: string; url?: string };

const TLD = '(?:com|net|org|io|co|gg|tv|me|app|dev|ly|be|fm|news|xyz|link|info|edu|gov|uk|ca)';

const PATTERN = new RegExp(
  // scheme or www. — everything up to whitespace belongs to the link
  '(?:https?:\\/\\/|www\\.)\\S+' +
    '|' +
    // bare domain, optionally with a path
    `[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9-]+)*\\.${TLD}(?:\\/\\S*)?`,
  'gi',
);

// Sentence punctuation sits outside the link: "see https://x.com/a." and
// "(https://x.com/a)" are both people quoting a URL, not part of it.
const TRAILING = /[.,!?;:'"\]}>]+$/;

function trimTail(raw: string): string {
  let out = raw.replace(TRAILING, '');
  // Keep parens the link itself opened (wiki URLs), drop the wrapping ones.
  while (out.endsWith(')') && count(out, '(') < count(out, ')')) out = out.slice(0, -1);
  return out;
}

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

function hasPrefix(s: string): boolean {
  return /^(?:https?:\/\/|www\.)/i.test(s);
}

// A period with no space after it reads as a domain to the regex ("done.Me
// too"). Real bare domains are typed in lower case, so requiring that throws
// the typos out without touching anything someone actually pasted.
function isLink(s: string): boolean {
  if (hasPrefix(s)) return true;
  const host = s.split('/')[0]; // the path keeps its capitals (youtu.be/dQw4…)
  return host === host.toLowerCase();
}

// Splits text into plain runs and link runs, in order. Parts with a `url` are
// the links; `text` is what to show, `url` is what to open.
export function linkify(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let at = 0;
  let plain = '';
  const push = () => {
    if (plain) parts.push({ text: plain });
    plain = '';
  };

  for (const m of text.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    const raw = m[0];
    const shown = trimTail(raw);
    plain += text.slice(at, start);
    at = start + raw.length;
    if (!shown || !isLink(shown)) {
      plain += raw;
      continue;
    }
    push();
    // Everything without a scheme gets https:// — Linking can't open a bare host.
    const url = /^https?:\/\//i.test(shown) ? shown : `https://${shown}`;
    parts.push({ text: shown, url });
    plain += raw.slice(shown.length); // the punctuation we trimmed off
  }
  plain += text.slice(at);
  push();
  return parts;
}

/** The first link in a message, or null — what the preview card is built on. */
export function firstLink(text: string): string | null {
  for (const part of linkify(text)) if (part.url) return part.url;
  return null;
}
