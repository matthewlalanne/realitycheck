import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import Panel from '../../components/Panel';
import FlipCard from '../../components/FlipCard';
import ScoreModal from '../../components/ScoreModal';
import LeaderboardPanel from '../../components/LeaderboardPanel';
import { useLeaderboard } from '../../lib/leaderboard';
import { contestants } from '../../data/realData';
import CastAvatar from '../../components/CastAvatar';

// Same three sizes as the site (Survivor League/app.js MEMORY_PAIR_OPTIONS) —
// shared leaderboard, keyed by pair count.
const PAIR_OPTIONS = [6, 8, 12] as const;
const CARD_GAP = 8;
const COLUMNS = 4;

type Card = { id: string };

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function MemoryGame({ boardWidth }: { boardWidth: number }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [pairs, setPairs] = useState<(typeof PAIR_OPTIONS)[number]>(6);
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const startRef = useRef(0);
  const { scores, record } = useLeaderboard('memory', String(pairs));

  useEffect(() => {
    if (!started || solved) return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [started, solved]);

  function begin(size: (typeof PAIR_OPTIONS)[number] = pairs) {
    const chosen = shuffle(contestants).slice(0, size);
    setCards(shuffle(chosen.flatMap((c) => [{ id: c.id }, { id: c.id }])));
    setPairs(size);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setElapsed(0);
    setSolved(false);
    setBusy(false);
    setStarted(true);
    startRef.current = Date.now();
  }

  // Same as the puzzle: an explicit exit, because the tab staying mounted
  // means navigating away otherwise leaves the clock running.
  function quit() {
    const end = () => {
      setStarted(false);
      setSolved(false);
      setMoves(0);
      setElapsed(0);
      setCards([]);
      setFlipped([]);
      setMatched([]);
    };
    if (solved) { end(); return; }
    Alert.alert('Leave the game?', 'Your time and moves for this run will be lost.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: end },
    ]);
  }

  function tap(pos: number) {
    if (!started || solved || busy) return;
    if (flipped.includes(pos) || matched.includes(pos)) return;
    const next = [...flipped, pos];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    setBusy(true);
    const [a, b] = next;
    const isMatch = cards[a].id === cards[b].id;
    setTimeout(() => {
      setMatched((prev) => {
        const updated = isMatch ? [...prev, a, b] : prev;
        if (updated.length === cards.length) {
          setSolved(true);
          setElapsed(Date.now() - startRef.current);
          setShowScoreModal(true);
        }
        return updated;
      });
      setFlipped([]);
      setBusy(false);
    }, isMatch ? 450 : 800);
  }

  const cardSize = (boardWidth - CARD_GAP * (COLUMNS - 1)) / COLUMNS;

  if (!started) {
    return (
      <View style={{ gap: 12 }}>
        <Panel style={{ gap: 12 }}>
          <Text style={styles.introTitle}>🌿 Memory Match</Text>
          <Text style={styles.introBody}>Match every castaway with their twin tile.</Text>
          <View style={styles.sizeRow}>
            {PAIR_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={[styles.sizeChip, pairs === n && styles.sizeChipActive]}
                onPress={() => setPairs(n)}
              >
                <Text style={[styles.sizeChipText, pairs === n && styles.sizeChipTextActive]}>{n} pairs</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.beginButton} onPress={() => begin(pairs)}>
            <Text style={styles.beginButtonText}>Begin</Text>
          </Pressable>
        </Panel>
        <LeaderboardPanel title={`Memory Leaderboard — ${pairs} pairs`} scores={scores} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.hud}>
        <Text style={styles.hudStat}>⏱ {fmtClock(elapsed)}</Text>
        <Text style={styles.hudStat}>🔀 {moves} moves</Text>
        <Text style={styles.hudStat}>{matched.length / 2}/{pairs} matched</Text>
        <Pressable style={styles.quitButton} onPress={quit} accessibilityRole="button" accessibilityLabel="Leave game">
          <Ionicons name="chevron-back" size={14} color={colors.textDim} />
          <Text style={styles.quitButtonText}>Leave</Text>
        </Pressable>
      </View>

      {solved && (
        <Panel style={styles.winPanel}>
          <Text style={styles.winTitle}>🌴 Matched all {pairs} pairs!</Text>
          <Text style={styles.winBody}>{fmtClock(elapsed)} &bull; {moves} moves</Text>
          <Pressable style={styles.beginButton} onPress={() => begin(pairs)}>
            <Text style={styles.beginButtonText}>Play Again</Text>
          </Pressable>
        </Panel>
      )}

      <View style={[styles.grid, { width: boardWidth }]}>
        {cards.map((card, pos) => {
          const isFlipped = flipped.includes(pos) || matched.includes(pos);
          const isMatched = matched.includes(pos);
          return (
            <Pressable key={pos} onPress={() => tap(pos)} disabled={solved}>
              <FlipCard
                flipped={isFlipped}
                style={{
                  width: cardSize,
                  height: cardSize * 1.3,
                  marginBottom: CARD_GAP,
                  marginRight: (pos + 1) % COLUMNS === 0 ? 0 : CARD_GAP,
                }}
                back={
                  <View style={[styles.cardFace, styles.cardBack]}>
                    <Text style={{ fontSize: 22 }}>🌴</Text>
                  </View>
                }
                front={
                  <View style={[styles.cardFace, isMatched && styles.cardFaceMatched]}>
                    <CastAvatar id={card.id} style={styles.cardPhoto} />
                  </View>
                }
              />
            </Pressable>
          );
        })}
      </View>

      {solved && <LeaderboardPanel title={`Memory Leaderboard — ${pairs} pairs`} scores={scores} />}

      <ScoreModal
        visible={showScoreModal}
        title={`🌴 Matched all ${pairs} pairs!`}
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
  beginButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  beginButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  quitButton: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  quitButtonText: { color: colors.textDim, fontSize: 12.5, fontWeight: '700' },
  hudStat: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  winPanel: { alignItems: 'center', backgroundColor: colors.panel2, gap: 10 },
  winTitle: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  winBody: { color: colors.textDim, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cardFace: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardFaceMatched: { borderColor: colors.accent, borderWidth: 2 },
  cardBack: { backgroundColor: colors.panel2 },
  cardPhoto: { width: '100%', height: '100%' },
});
