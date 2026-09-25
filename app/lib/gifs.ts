import { useCallback, useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// GIF search, through our own Cloud Function rather than straight to GIPHY.
//
// The phone never sees the API key and GIPHY never sees the phone: what
// leaves our server is a search term, with nothing attached to say who typed
// it. The function also caches every result set, because a free key allows
// 100 searches an hour for the whole league and a live episode could
// otherwise burn through that in minutes.
export type Gif = {
  id: string;
  /** Full size — this is what gets sent to the chat. */
  url: string;
  /** Animated but lighter, for the picker grid. */
  thumb?: string;
  /** A single still frame. Only a placeholder now that the grid animates. */
  preview?: string;
  width?: number;
  height?: number;
  title?: string;
};

const search = httpsCallable<{ q: string }, { gifs: Gif[]; cached?: boolean; stale?: boolean }>(
  functions,
  'gifSearch',
);

export type GifSearchState = {
  gifs: Gif[];
  loading: boolean;
  error: string | null;
};

/**
 * Trending while the box is empty, results once it isn't. Typing is debounced
 * so a search fires when someone stops typing rather than once per letter —
 * cached or not, that's the difference between one call and fifteen.
 */
export function useGifSearch(query: string, enabled: boolean): GifSearchState {
  const [state, setState] = useState<GifSearchState>({ gifs: [], loading: false, error: null });
  // Results can arrive out of order when someone types quickly; only the
  // newest query is allowed to write to the screen.
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    const t = setTimeout(async () => {
      try {
        const res = await search({ q: query.trim() });
        if (mine !== latest.current) return;
        setState({ gifs: res.data.gifs || [], loading: false, error: null });
      } catch (err) {
        if (mine !== latest.current) return;
        const code = (err as { code?: string })?.code ?? '';
        setState({
          gifs: [],
          loading: false,
          error: code.includes('resource-exhausted')
            ? "The league has used up this hour's GIF searches. Try again shortly."
            : "Couldn't load GIFs. Check your connection.",
        });
      }
    }, query.trim() ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, enabled]);

  return state;
}

/** Clears results when the picker closes, so it doesn't reopen on stale ones. */
export function useResetOnClose(open: boolean, reset: () => void) {
  const was = useRef(open);
  useEffect(() => {
    if (was.current && !open) reset();
    was.current = open;
  }, [open, reset]);
}
