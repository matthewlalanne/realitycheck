import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, serverTimestamp, update } from 'firebase/database';
import { rtdb } from './firebase';
import { LIMITS, clamp } from './limits';

// Your own pre-draft board: a private ranking of the cast plus a note on
// anyone you want to remember something about.
//
// Deliberately OUTSIDE `league`, the same way avatars, typing and read
// receipts are, and for the reason spelled out at the top of
// database.rules.json: a draft pick is a transaction that writes the whole
// league subtree back, and the database validates every value inside it. One
// over-long note filed under `league` would stop every pick, for everyone,
// exactly like the chat message that broke the Denver draft. Here it cannot
// reach the draft at all — a bad note fails its own write and nothing else.
//
// It also keeps the notes off the record every client subscribes to, so
// nobody's board arrives on everyone else's phone.
const BOARDS = 'draftBoards';

export type Board = { order?: string[]; notes?: Record<string, string> };

const path = (leagueKey: string, personId: string) => `${BOARDS}/${leagueKey}/${personId}`;

/** This person's board in this league. Empty until they rank or note something. */
export function useBoard(leagueKey: string, personId: string): Board {
  const [board, setBoard] = useState<Board>({});
  useEffect(() => {
    if (!leagueKey || !personId) return;
    return onValue(ref(rtdb, path(leagueKey, personId)), (snap) => {
      setBoard((snap.val() as Board) || {});
    });
  }, [leagueKey, personId]);
  return board;
}

/**
 * The full cast in board order: everyone they've ranked first, in their
 * order, then everyone they haven't, alphabetically. A saved order that
 * mentions someone no longer in the cast is ignored rather than left as a
 * gap, so the list always matches who's actually playing.
 */
export function boardOrder<T extends { id: string; name: string }>(board: Board, cast: T[]): T[] {
  const byId = new Map(cast.map((c) => [c.id, c]));
  const ranked = (board.order || []).map((id) => byId.get(id)).filter(Boolean) as T[];
  const seen = new Set(ranked.map((c) => c.id));
  const rest = cast.filter((c) => !seen.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  return [...ranked, ...rest];
}

/** 1-based rank, or null for anyone they haven't placed yet. */
export function rankOf(board: Board, contestantId: string): number | null {
  const i = (board.order || []).indexOf(contestantId);
  return i < 0 ? null : i + 1;
}

export function noteOf(board: Board, contestantId: string): string {
  return board.notes?.[contestantId] || '';
}

function save(leagueKey: string, personId: string, patch: Record<string, unknown>) {
  return update(ref(rtdb, path(leagueKey, personId)), { ...patch, at: serverTimestamp() });
}

export function saveOrder(leagueKey: string, personId: string, order: string[]) {
  return save(leagueKey, personId, { order });
}

/** An empty note removes the entry rather than storing a blank string. */
export function saveNote(leagueKey: string, personId: string, contestantId: string, text: string) {
  const trimmed = clamp(text, LIMITS.boardNote).trim();
  return save(leagueKey, personId, { [`notes/${contestantId}`]: trimmed || null });
}

/**
 * Moving someone is a whole-list write: the board only stores an order once
 * anyone is moved, so the first move has to settle where everybody else
 * stands too. `cast` is what fills that in.
 */
export function moveInBoard<T extends { id: string; name: string }>(
  board: Board,
  cast: T[],
  contestantId: string,
  to: 'up' | 'down' | 'top' | 'bottom',
): string[] {
  const ids = boardOrder(board, cast).map((c) => c.id);
  const from = ids.indexOf(contestantId);
  if (from < 0) return ids;
  const target =
    to === 'up' ? from - 1 : to === 'down' ? from + 1 : to === 'top' ? 0 : ids.length - 1;
  if (target < 0 || target >= ids.length || target === from) return ids;
  ids.splice(from, 1);
  ids.splice(target, 0, contestantId);
  return ids;
}

/** Everything the board screens need, with the writes already bound to you. */
export function useMyBoard(leagueKey: string, personId: string) {
  const board = useBoard(leagueKey, personId);
  const move = useCallback(
    <T extends { id: string; name: string }>(cast: T[], contestantId: string, to: 'up' | 'down' | 'top' | 'bottom') =>
      saveOrder(leagueKey, personId, moveInBoard(board, cast, contestantId, to)).catch(() => {}),
    [board, leagueKey, personId],
  );
  const setNote = useCallback(
    (contestantId: string, text: string) => saveNote(leagueKey, personId, contestantId, text),
    [leagueKey, personId],
  );
  return { board, move, setNote };
}
