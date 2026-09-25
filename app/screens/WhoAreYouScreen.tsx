import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { wordmarkFont } from '../theme';
import Panel from '../components/Panel';
import { useTopInset } from '../components/ScreenHeader';
import type { Identity } from '../lib/identity';
import { LEAGUE_KEYS, peopleOf, type LeagueRoot } from '../lib/state';

// Same two-step picker as the website: which league, then which name.
export default function WhoAreYouScreen({
  root,
  current,
  onChoose,
  onCancel,
}: {
  root: LeagueRoot;
  current: Identity | null;
  onChoose: (id: Identity) => void;
  onCancel?: () => void;
}) {
  const [leagueKey, setLeagueKey] = useState<string | null>(null);
  const league = leagueKey ? root.leagues[leagueKey] : null;
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  // This screen sits outside the tab navigator (and also opens as a modal from
  // Settings), so it has to clear the notch on its own.
  const top = useTopInset();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: top }]}>
      <Text style={styles.wordmark}>REALITY CHECK</Text>
      {!league ? (
        <>
          <Text style={styles.title}>Which league are you in?</Text>
          <Text style={styles.hint}>Pick your league so we can track your picks.</Text>
          {[
            ...LEAGUE_KEYS.filter((k) => root.leagues[k]),
            ...Object.keys(root.leagues).filter((k) => !LEAGUE_KEYS.includes(k)),
          ].map((k) => (
            <Pressable key={k} onPress={() => setLeagueKey(k)}>
              <Panel style={styles.choice}>
                <Text style={styles.choiceText}>{root.leagues[k].name}</Text>
                <Text style={styles.choiceMeta}>{peopleOf(root.leagues[k]).length} players</Text>
              </Panel>
            </Pressable>
          ))}
          {onCancel && (
            <Pressable style={styles.cancel} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          )}
        </>
      ) : (
        <>
          <Text style={styles.title}>Who are you?</Text>
          <Text style={styles.hint}>{league.name} — tap your name. If you're in more than one league, any of them will do; you can switch once you're in.</Text>
          <View style={styles.grid}>
            {league.players.flatMap((entry) => {
              // Couples draft as one entry but sign in as themselves. Just the
              // names here — the entry's name under only some of them left the
              // grid looking lopsided.
              const members = entry.members?.length ? entry.members : [{ id: entry.id, name: entry.name }];
              return members.map((m) => {
                const isCurrent = current?.leagueKey === leagueKey && current?.playerId === m.id;
                return (
                  <Pressable key={m.id} style={styles.gridItem} onPress={() => onChoose({ leagueKey: leagueKey!, playerId: m.id, playerName: m.name })}>
                    <Panel style={[styles.nameCard, isCurrent && styles.nameCardCurrent]}>
                      <Text style={styles.nameText}>{m.name}</Text>
                    </Panel>
                  </Pressable>
                );
              });
            })}
          </View>
          <Pressable style={styles.cancel} onPress={() => setLeagueKey(null)}>
            <Text style={styles.cancelText}>← Back to leagues</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  wordmark: { color: colors.accent, fontFamily: wordmarkFont, fontSize: 30, letterSpacing: 3, textAlign: 'center', marginBottom: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: 13, marginBottom: 6 },
  choice: { gap: 2 },
  choiceText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  choiceMeta: { color: colors.textDim, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%' },
  nameCard: { alignItems: 'center', paddingVertical: 18 },
  nameCardCurrent: { borderColor: colors.accent, borderWidth: 2 },
  nameText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  cancelText: { color: colors.accent2, fontSize: 14 },
});
