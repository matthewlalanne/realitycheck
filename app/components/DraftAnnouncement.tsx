import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import { useThemeColors } from '../contexts/ThemeContext';
import { useLeague } from '../contexts/LeagueContext';
import { useDraftRoot } from '../lib/state';
import CastAvatar from '../components/CastAvatar';
import type { ColorScheme } from '../theme';

const alertSound = require('../assets/sounds/survivor_alert.mp3');

// How long the card stays up. The audio is paused with it so the sound never
// outlives the thing it's announcing.
const SHOW_MS = 5000;
// Picks older than this are history, not news — this is what stops the app
// replaying the last pick every time someone opens it mid-draft.
const FRESH_MS = 25000;

type Announcement = { playerName: string; castName: string; castId: string };

// Draft picks land in the shared league record from either platform, so this
// fires on every phone when anyone drafts — whether they picked on the app or
// on the website. With Practice draft on, it follows the practice copy instead.
export default function DraftAnnouncement() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { root: liveRoot, leagueKey, myLeagueKeys } = useLeague();
  const { practice, root } = useDraftRoot(liveRoot);
  // Follow whichever of my leagues is actually drafting, not just the one on
  // screen — Matt and AJ could be looking at Porterville while Denver drafts.
  const draftKey =
    myLeagueKeys.find((k) => {
      const d = root?.leagues?.[k]?.draftState;
      return d?.started && !d.complete;
    }) ?? leagueKey;
  const league = root?.leagues?.[draftKey];
  const sourceId = `${practice ? 'practice' : 'live'}:${draftKey}`;
  const player = useAudioPlayer(alertSound);

  const [shown, setShown] = useState<Announcement | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const seenAt = useRef<number | null>(null);
  const primedFor = useRef<string | null>(null);

  const history = league?.draftState?.history ?? [];
  const last = history.length ? history[history.length - 1] : null;

  useEffect(() => {
    if (!root || !league) return;

    // First pass just records where the draft already is, so joining late
    // doesn't trigger an announcement for a pick that happened hours ago.
    // It primes even when there are no picks yet — otherwise the very first
    // pick of a draft was swallowed as the priming pass and never announced.
    if (primedFor.current !== sourceId) {
      primedFor.current = sourceId;
      seenAt.current = last ? last.at : null;
      return;
    }
    if (!last || last.at === seenAt.current) return;
    seenAt.current = last.at;
    if (Date.now() - last.at > FRESH_MS) return;

    const castName = root.contestants?.find((c) => c?.id === last.contestantId)?.name ?? 'a pick';
    const playerName = league.players.find((p) => p.id === last.playerId)?.name ?? last.playerId;
    setShown({ playerName, castName, castId: last.contestantId });

    try {
      player.seekTo(0);
      player.play();
    } catch {
      // A missing audio route shouldn't take the announcement down with it.
    }
  }, [last?.at, last, root, league, player, sourceId]);

  useEffect(() => {
    if (!shown) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => setShown(null));
      try { player.pause(); } catch { /* already stopped */ }
    }, SHOW_MS);

    return () => clearTimeout(t);
  }, [shown, anim, player]);

  if (!shown) return null;

  return (
    <View style={[styles.layer, { paddingTop: insets.top + 8 }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.card,
          {
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) },
            ],
          },
        ]}
      >
        {true ? (
          <CastAvatar id={shown.castId} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]} />
        )}
        <View style={styles.copy}>
          <Text style={styles.kicker}>DRAFT PICK</Text>
          <Text style={styles.line} numberOfLines={2}>
            <Text style={styles.strong}>{shown.playerName}</Text> drafted{' '}
            <Text style={styles.strong}>{shown.castName}</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 50,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.panel2,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 13,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  photo: { width: 46, height: 46, borderRadius: 23 },
  photoEmpty: { backgroundColor: colors.bg2 },
  copy: { flex: 1 },
  kicker: {
    color: colors.accent2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  line: { color: colors.text, fontSize: 14.5, lineHeight: 19 },
  strong: { color: colors.accent, fontWeight: '800' },
});
