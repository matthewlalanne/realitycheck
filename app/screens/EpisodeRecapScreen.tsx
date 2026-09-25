import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import BackButton from '../components/BackButton';
import { PinnedHeader } from '../components/ScreenHeader';
import { useLeague } from '../contexts/LeagueContext';
import CastAvatar from '../components/CastAvatar';
import { episodeHighlights } from '../lib/seasonStats';
import { eliminatedInEpisode, ownersOf, shortName } from '../lib/state';
import { recapParts } from '../lib/recap';
import { OutBadge } from '../components/CastawayStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeRecap'>;

// One episode, read as a page: the facts at a glance up top, then the
// commissioner's full write-up.
export default function EpisodeRecapScreen({ route, navigation }: Props) {
  const { episode } = route.params;
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { root, league } = useLeague();
  const cast = root.contestants ?? [];
  const { title, body } = recapParts(root, episode);
  const out = eliminatedInEpisode(root, episode);
  const highlights = episodeHighlights(root, episode, (id) => {
    const n = cast.find((c) => c?.id === id)?.name;
    return n ? shortName(n) : id;
  });

  return (
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <PinnedHeader title={`Episode ${episode}`} subtitle={title ?? 'Recap'} topInset={false} />
      <ScrollView contentContainerStyle={styles.content}>
        {(out.length > 0 || highlights.length > 0) && (
          <Panel style={styles.glance}>
            {out.map((c) => {
              const owners = ownersOf(league, c.id)
                .map((id) => league.players.find((p) => p.id === id)?.name)
                .filter(Boolean)
                .join(', ');
              return (
                <View key={c.id} style={styles.outRow}>
                  {<CastAvatar id={c.id} style={styles.outPhoto} />}
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.outTop}>
                      <Text style={styles.outName} numberOfLines={1}>{c.name}</Text>
                      <OutBadge ep={episode} />
                    </View>
                    {!!owners && <Text style={styles.outOwner}>{owners}'s pick</Text>}
                  </View>
                </View>
              );
            })}
            {highlights.map((h, i) => (
              <View key={i} style={styles.hlRow}>
                <Text style={styles.hlLabel}>{h.label}</Text>
                <Text style={styles.hlText}>{h.text}</Text>
              </View>
            ))}
          </Panel>
        )}

        {body ? (
          <Text style={styles.body}>{body}</Text>
        ) : (
          <Text style={styles.empty}>No recap written for this episode yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backBar: { paddingHorizontal: 20, backgroundColor: colors.bg, zIndex: 11 },
  content: { padding: 20, paddingTop: 18, paddingBottom: 48, gap: 18 },
  glance: { gap: 10 },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  outPhoto: { width: 40, height: 40, borderRadius: 20 },
  outTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outName: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  outOwner: { color: colors.textDim, fontSize: 12.5 },
  hlRow: { flexDirection: 'row', gap: 12 },
  hlLabel: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', width: 104, paddingTop: 2 },
  hlText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  body: { color: colors.text, fontSize: 16, lineHeight: 25 },
  empty: { color: colors.textDim, fontSize: 14, fontStyle: 'italic', marginTop: 12 },
});
