import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Open Graph cards for links posted in the chat, fetched on the device that's
// reading them. There's no server in front of this: React Native's fetch has
// no same-origin rules, so the page can be read directly.
//
// That does mean the viewer's phone talks to whatever site was linked, which
// is why nothing is fetched until a message with a link is actually on screen,
// and why the result is cached rather than re-fetched per render.
export type Preview = {
  title?: string;
  description?: string;
  image?: string;
  host: string;
};

const storageKey = (url: string) => `outlast-linkpreview-${url}`;

// A card that resolved keeps for a week; a link that gave us nothing is
// remembered for a day, so a dead or hostile URL isn't re-fetched on every
// trip into the chat.
const TTL_OK = 7 * 24 * 60 * 60 * 1000;
const TTL_MISS = 24 * 60 * 60 * 1000;

const FETCH_TIMEOUT = 8000;
// Only the <head> matters, and some pages are megabytes of markup.
const PARSE_LIMIT = 200_000;

type Entry = { preview: Preview | null; at: number };

// Shared across every bubble showing the same URL — two people posting the
// same link shouldn't cost two fetches.
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<Preview | null>>();

function fresh(entry: Entry): boolean {
  return Date.now() - entry.at < (entry.preview ? TTL_OK : TTL_MISS);
}

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return (m?.[1] ?? url).replace(/^www\./i, '');
}

// Meta tags are written every which way — property before content or after,
// single or double quotes — so the attribute order isn't assumed.
function meta(html: string, key: string): string | undefined {
  const attr = `(?:property|name)=["']${key}["']`;
  const patterns = [
    new RegExp(`<meta[^>]+${attr}[^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return decode(m[1].trim());
  }
  return undefined;
}

// Enough of the HTML entities to keep titles readable; anything rarer is
// better left as-is than half-decoded.
function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function absolute(src: string, pageUrl: string): string | undefined {
  if (/^https?:\/\//i.test(src)) return src;
  try {
    if (src.startsWith('//')) return `https:${src}`;
    const origin = /^(https?:\/\/[^/]+)/i.exec(pageUrl)?.[1];
    if (!origin) return undefined;
    return src.startsWith('/') ? `${origin}${src}` : `${origin}/${src}`;
  } catch {
    return undefined;
  }
}

async function load(url: string): Promise<Preview | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html')) return null;
    const html = (await res.text()).slice(0, PARSE_LIMIT);

    const title =
      meta(html, 'og:title') ||
      meta(html, 'twitter:title') ||
      decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || '') ||
      undefined;
    const description = meta(html, 'og:description') || meta(html, 'twitter:description');
    const rawImage = meta(html, 'og:image') || meta(html, 'twitter:image');
    const image = rawImage ? absolute(rawImage, url) : undefined;

    // A card with neither a title nor a picture is just a second copy of the
    // link, so it's treated as a miss.
    if (!title && !image) return null;
    return { title, description, image, host: hostOf(url) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function remember(url: string, preview: Preview | null) {
  const entry = { preview, at: Date.now() };
  memory.set(url, entry);
  AsyncStorage.setItem(storageKey(url), JSON.stringify(entry)).catch(() => {});
}

/**
 * The card for `url`, or null while it's loading and for links that don't have
 * one. Safe to call with null when a message has no link.
 */
export function useLinkPreview(url: string | null): Preview | null {
  const [preview, setPreview] = useState<Preview | null>(() => {
    const hit = url ? memory.get(url) : undefined;
    return hit && fresh(hit) ? hit.preview : null;
  });

  useEffect(() => {
    if (!url) { setPreview(null); return; }
    let alive = true;

    const hit = memory.get(url);
    if (hit && fresh(hit)) { setPreview(hit.preview); return; }

    (async () => {
      const stored = await AsyncStorage.getItem(storageKey(url)).catch(() => null);
      if (!alive) return;
      if (stored) {
        try {
          const entry = JSON.parse(stored) as Entry;
          if (fresh(entry)) {
            memory.set(url, entry);
            setPreview(entry.preview);
            return;
          }
        } catch {
          // A corrupt entry just means fetching again.
        }
      }

      // One fetch per URL even when several bubbles mount at once.
      let pending = inflight.get(url);
      if (!pending) {
        pending = load(url).then((result) => {
          remember(url, result);
          inflight.delete(url);
          return result;
        });
        inflight.set(url, pending);
      }
      const result = await pending;
      if (alive) setPreview(result);
    })();

    return () => { alive = false; };
  }, [url]);

  return preview;
}
