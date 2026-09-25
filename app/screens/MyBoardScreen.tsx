import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import { PinnedHeader, CONTENT_TOP_GAP } from '../components/ScreenHeader';
import BackButton from '../components/BackButton';
import NoteEditor from '../components/NoteEditor';
import { useLeague } from '../contexts/LeagueContext';
import CastAvatar from '../components/CastAvatar';
import { useLiveContestants } from '../lib/episodes';
import { boardOrder, noteOf, useMyBoard } from '../lib/board';

type Props = NativeStackScreenProps<RootStackParamList, 'MyBoard'>;

// Your own board: the cast in the order YOU want them, with a note on anyone
// worth remembering. Nothing here is shared, and nothing here touches the
// league record — see lib/board.ts for why that separation matters.
export default function MyBoardScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { leagueKey, playerId } = useLeague();
  const { contestants } = useLiveContestants();
  const { board, move, setNote } = useMyBoard(leagueKey, playerId);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const ranked = boardOrder(board, contestants);
  const noted = ranked.filter((c) => noteOf(board, c.id)).length;

  return (
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <PinnedHeader title="My board" topInset={false} />
      <FlatList
        contentContainerStyle={styles.content}
        data={ranked}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <Panel style={styles.intro}>
            <Text style={styles.introTitle}>Rank them, note them</Text>
            <Text style={styles.introBody}>
              Chevrons move someone one place; the circled arrows send them straight to the top or
              the bottom. Tap anyone to write a note. Both show up on the draft board when it's
              your pick.
            </Text>
            <Text style={styles.introMeta}>
              {noted ? `${noted} note${noted === 1 ? '' : 's'} written` : 'No notes yet'} · only you can see this
            </Text>
          </Panel>
        }
        renderItem={({ item: c, index }) => {
          const note = noteOf(board, c.id);
          const atTop = index === 0;
          const atBottom = index === ranked.length - 1;
          return (
            <Pressable onPress={() => setEditing({ id: c.id, name: c.name })}>
              <Panel style={styles.card}>
                <Text style={styles.rank}>{index + 1}</Text>
                <CastAvatar id={c.id} style={styles.photo} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                  {note ? (
                    <Text style={styles.note} numberOfLines={2}>{note}</Text>
                  ) : (
                    <Text style={styles.notePlaceholder}>Tap to add a note</Text>
                  )}
                </View>
                {/* Its own Pressables, so a tap on an arrow moves them
                    instead of opening the note box. Laid out as a square:
                    both upward moves on the top row, both downward on the
                    bottom, jump-to-the-end on the left of each. */}
                <View style={styles.moveGrid}>
                  <View style={styles.moveRow}>
                    <MoveButton
                      icon="arrow-up-circle-outline"
                      label={`Move ${c.name} to the top`}
                      disabled={atTop}
                      onPress={() => move(contestants, c.id, 'top')}
                    />
                    <MoveButton
                      icon="chevron-up"
                      label={`Move ${c.name} up`}
                      disabled={atTop}
                      onPress={() => move(contestants, c.id, 'up')}
                    />
                  </View>
                  <View style={styles.moveRow}>
                    <MoveButton
                      icon="arrow-down-circle-outline"
                      label={`Move ${c.name} to the bottom`}
                      disabled={atBottom}
                      onPress={() => move(contestants, c.id, 'bottom')}
                    />
                    <MoveButton
                      icon="chevron-down"
                      label={`Move ${c.name} down`}
                      disabled={atBottom}
                      onPress={() => move(contestants, c.id, 'down')}
                    />
                  </View>
                </View>
              </Panel>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {editing && (
        <NoteEditor
          visible
          contestantId={editing.id}
          name={editing.name}
          initial={noteOf(board, editing.id)}
          onSave={(text) => setNote(editing.id, text).catch(() => {})}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

// The four moves are the same button four times over — keeping them one
// component is what stops them drifting apart in size or hit area.
function MoveButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <Pressable
      style={styles.moveBtn}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={21} color={disabled ? colors.line : colors.text} />
    </Pressable>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  // Opaque and above the header, so the header's drop shadow can't show
  // in the strip over the title — see the shadow note in ScreenHeader.
  backBar: { paddingHorizontal: 20, backgroundColor: colors.bg, zIndex: 11 },
  content: { padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 40 },
  intro: { marginBottom: 12, backgroundColor: colors.panel2 },
  introTitle: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  introBody: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 4 },
  introMeta: { color: colors.accent2, fontSize: 12, fontWeight: '700', marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rank: { color: colors.accent, fontSize: 15, fontWeight: '800', width: 22, textAlign: 'center' },
  photo: { width: 44, height: 44, borderRadius: 22 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  note: { color: colors.textDim, fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  notePlaceholder: { color: colors.textDim, fontSize: 12, marginTop: 3, opacity: 0.7 },
  moveGrid: { gap: 2 },
  moveRow: { flexDirection: 'row', gap: 2 },
  moveBtn: { paddingVertical: 3, paddingHorizontal: 4 },
});
