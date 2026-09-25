import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, runTransaction } from 'firebase/database';
import { rtdb } from './firebase';

// Game leaderboards live in the same shared league record the website uses
// (league/puzzleScores/{size} and league/memoryScores/{pairs}), so a score set
// on a phone shows up on the site and vice versa. This was per-device
// AsyncStorage, which is why app players never saw anyone else's times.
export type ScoreEntry = { name: string; ms: number; moves: number; at: number };

const ROOT = 'league';
const TOP_N = 10;

function pathFor(game: string, variant: string) {
  const branch = game === 'memory' ? 'memoryScores' : 'puzzleScores';
  return `${ROOT}/${branch}/${variant}`;
}

// The website writes these as JSON arrays. Firebase returns an array when the
// keys are dense but an object when anything is sparse, so normalise both
// shapes rather than trusting one.
function toList(value: unknown): ScoreEntry[] {
  if (Array.isArray(value)) return value.filter(Boolean) as ScoreEntry[];
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, ScoreEntry>).filter(Boolean);
  }
  return [];
}

function rank(list: ScoreEntry[]): ScoreEntry[] {
  return [...list].sort((a, b) => a.ms - b.ms || a.moves - b.moves).slice(0, TOP_N);
}

export function useLeaderboard(game: string, variant: string) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const path = pathFor(game, variant);

  useEffect(() => onValue(ref(rtdb, path), (snap) => setScores(rank(toList(snap.val())))), [path]);

  const record = useCallback(
    async (entry: Omit<ScoreEntry, 'at'>) => {
      // A transaction, not a plain write: two people finishing at the same
      // moment would otherwise clobber each other's score.
      await runTransaction(ref(rtdb, path), (current) =>
        rank([...toList(current), { ...entry, at: Date.now() }]),
      );
    },
    [path],
  );

  return { scores, record };
}
