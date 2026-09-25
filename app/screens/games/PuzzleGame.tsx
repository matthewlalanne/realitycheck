import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import Panel from '../../components/Panel';
import ScoreModal from '../../components/ScoreModal';
import LeaderboardPanel from '../../components/LeaderboardPanel';
import { useLeaderboard } from '../../lib/leaderboard';

// Same three boards as the site (Survivor League/app.js PUZZLE_SIZE_OPTIONS) —
// the leaderboard is shared and keyed by size, so the lists have to match.
const SIZE_OPTIONS = [3, 4, 5] as const;
// Our own art, not the season logo (that's CBS's). Confirm the image's licence before launch.
const puzzleImage = require('../../assets/backgrounds/tropical-sunset.jpg');

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function solvedState(n: number) {
  return Array.from({ length: n * n }, (_, i) => i);
}

function isSolvable(arr: number[], n: number, blank: number) {
  const flat = arr.filter((t) => t !== blank);
  let inv = 0;
  for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) if (flat[i] > flat[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = n - Math.floor(arr.indexOf(blank) / n);
  return blankRowFromBottom % 2 === 0 === (inv % 2 === 1);
}

function shufflePuzzle(n: number) {
  const blank = n * n - 1;
  let arr = solvedState(n);
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  } while (!isSolvable(arr, n, blank) || arr.every((t, i) => t === i));
  return arr;
}

export default function PuzzleGame({ boardWidth }: { boardWidth: number }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [n, setN] = useState<(typeof SIZE_OPTIONS)[number]>(3);
  const [tiles, setTiles] = useState<number[]>(solvedState(3));
  const [started, setStarted] = useState(false);
  const [solved, setSolved] = useState(false);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const startRef = useRef(0);
  const { scores, record } = useLeaderboard('puzzle', String(n));

  useEffect(() => {
    if (!started || solved) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [started, solved]);

  function begin(size = n) {
    setN(size);
    setTiles(shufflePuzzle(size));
    setMoves(0);
    setElapsed(0);
    setSolved(false);
    setStarted(true);
    startRef.current = Date.now();
  }

  // Leaving has to actually end the run: switching tabs keeps this screen
  // mounted, so without an explicit quit the clock just kept ticking.
  function quit() {
    const end = () => {
      setStarted(false);
      setSolved(false);
      setMoves(0);
      setElapsed(0);
      setTiles(solvedState(n));
    };
    if (solved) { end(); return; }
    Alert.alert('Leave the puzzle?', 'Your time and moves for this run will be lost.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: end },
    ]);
  }

  function tap(pos: number) {
    if (!started || solved) return;
    const blank = n * n - 1;
    const blankPos = tiles.indexOf(blank);
    const r1 = Math.floor(pos / n), c1 = pos % n;
    const r2 = Math.floor(blankPos / n), c2 = blankPos % n;
    const adjacent = (r1 === r2 && Math.abs(c1 - c2) === 1) || (c1 === c2 && Math.abs(r1 - r2) === 1);
    if (!adjacent) return;
    const next = [...tiles];
    [next[pos], next[blankPos]] = [next[blankPos], next[pos]];
    setTiles(next);
    setMoves((m) => m + 1);
    if (next.every((t, i) => t === i)) {
      setSolved(true);
      setElapsed(Date.now() - startRef.current);
      setShowScoreModal(true);
    }
  }

  const board = boardWidth;
  const cell = Math.floor(board / n);
  const blankPiece = n * n - 1;

  if (!started) {
    return (
      <View style={{ gap: 12 }}>
        <Panel style={{ gap: 12 }}>
          <Text style={styles.introTitle}>🧩 Logo Puzzle</Text>
          <Text style={styles.introBody}>Rebuild the picture, one tile at a time.</Text>
          <View style={styles.sizeRow}>
            {SIZE_OPTIONS.map((s) => (
              <Pressable key={s} style={[styles.sizeChip, n === s && styles.sizeChipActive]} onPress={() => setN(s)}>
                <Text style={[styles.sizeChipText, n === s && styles.sizeChipTextActive]}>{s}×{s}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.beginButton} onPress={() => begin(n)}>
            <Text style={styles.beginButtonText}>Begin</Text>
          </Pressable>
        </Panel>
        <LeaderboardPanel title={`Puzzle Leaderboard — ${n}×${n}`} scores={scores} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.hud}>
        <Text style={styles.hudStat}>⏱ {fmtClock(elapsed)}</Text>
        <Text style={styles.hudStat}>🔀 {moves} moves</Text>
        <Pressable style={styles.quitButton} onPress={quit} accessibilityRole="button" accessibilityLabel="Leave game">
          <Ionicons name="chevron-back" size={14} color={colors.textDim} />
          <Text style={styles.quitButtonText}>Leave</Text>
        </Pressable>
      </View>

      {solved && (
        <Panel style={styles.winPanel}>
          <Text style={styles.winTitle}>🏆 Solved!</Text>
          <Text style={styles.winBody}>{fmtClock(elapsed)} &bull; {moves} moves</Text>
          <Pressable style={styles.beginButton} onPress={() => begin(n)}>
            <Text style={styles.beginButtonText}>Play Again</Text>
          </Pressable>
        </Panel>
      )}

      <View style={[styles.board, { width: board, height: board }]}>
        {tiles.map((piece, pos) => {
          if (piece === blankPiece) return <View key={pos} style={{ width: cell, height: cell }} />;
          const row = Math.floor(piece / n), col = piece % n;
          return (
            <Pressable key={pos} onPress={() => tap(pos)} style={[styles.tile, { width: cell, height: cell }]}>
              <Image
                source={puzzleImage}
                style={{ width: board, height: board, position: 'absolute', left: -col * cell, top: -row * cell }}
              />
            </Pressable>
          );
        })}
      </View>

      {solved && <LeaderboardPanel title={`Puzzle Leaderboard — ${n}×${n}`} scores={scores} />}

      <ScoreModal
        visible={showScoreModal}
        title="🏆 Solved!"
        onSave={(name) => {
          record({ name, ms: elapsed, moves });
          setShowScoreModal(false);
        }}
        onSkip={() => setShowScoreModal(false)}
      />
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  introTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  introBody: { color: colors.textDim, fontSize: 13 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg2,
  },
  sizeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sizeChipText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  sizeChipTextActive: { color: colors.onAccent },
  beginButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  beginButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  quitButton: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  quitButtonText: { color: colors.textDim, fontSize: 12.5, fontWeight: '700' },
  hudStat: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  winPanel: { alignItems: 'center', backgroundColor: colors.panel2, gap: 10 },
  winTitle: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  winBody: { color: colors.textDim, fontSize: 13 },
  board: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.bg2, alignSelf: 'center' },
  tile: { overflow: 'hidden', borderWidth: 0.5, borderColor: colors.bg },
});
