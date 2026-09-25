import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import BackButton from '../components/BackButton';
import { PinnedHeader } from '../components/ScreenHeader';
import { useLeague } from '../contexts/LeagueContext';
import CastAvatar from '../components/CastAvatar';
import { LIMITS } from '../lib/limits';
import {
  TRIBE_COLORS, addTribe, removeTribe, saveTribe, setContestantTribe, textOnTribe, tribesOf, type TribeEntry,
} from '../lib/tribes';

type Props = NativeStackScreenProps<RootStackParamList, 'Tribes'>;

// Commissioner-only: name and color each tribe, then put every castaway on
// one. Changes save as you make them and show up for everyone straight away.
export default function TribesScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { root } = useLeague();
  const tribes = tribesOf(root);
  const cast = (root.contestants ?? []).filter(Boolean).slice().sort((a, b) => a.name.localeCompare(b.name));

  const confirmRemove = (t: TribeEntry) => {
    Alert.alert(`Remove ${t.name}?`, 'Everyone on it goes back to no tribe.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTribe(root, t.id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <PinnedHeader title="Tribes" topInset={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tribes.map((t) => (
          <TribeEditor key={t.id} tribe={t} styles={styles} onRemove={() => confirmRemove(t)} />
        ))}
        <Pressable style={styles.addBtn} onPress={() => addTribe(root)}>
          <Text style={styles.addText}>+ Add tribe</Text>
        </Pressable>

        {tribes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Castaways</Text>
            <Panel style={styles.castPanel}>
              {cast.map((c, i) => (
                <View key={c.id} style={[styles.castRow, i === 0 && styles.castRowFirst]}>
                  <CastAvatar id={c.id} style={styles.photo} />
                  <Text style={[styles.castName, !!c.eliminatedWeek && styles.castOut]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <View style={styles.chips}>
                    {tribes.map((t) => {
                      const on = c.tribe === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => setContestantTribe(root, c.id, on ? null : t.id)}
                          style={[styles.chip, { borderColor: t.color }, on && { backgroundColor: t.color }]}
                        >
                          <Text style={[styles.chipText, on && { color: textOnTribe(t.color) }]} numberOfLines={1}>{t.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </Panel>
            <Text style={styles.hint}>Tap a tribe to move someone onto it; tap it again to take them off.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TribeEditor({ tribe, styles, onRemove }: { tribe: TribeEntry; styles: ReturnType<typeof makeStyles>; onRemove: () => void }) {
  const colors = useThemeColors();
  // Local while typing; saved when you finish, so every keystroke isn't a write.
  const [name, setName] = useState(tribe.name);
  useEffect(() => { setName(tribe.name); }, [tribe.name]);
  const commitName = () => {
    const next = name.trim();
    if (next && next !== tribe.name) saveTribe(tribe.id, { name: next, color: tribe.color });
    else setName(tribe.name);
  };

  return (
    <Panel style={[styles.tribeCard, { borderColor: tribe.color }]}>
      <View style={styles.tribeTop}>
        <View style={[styles.dot, { backgroundColor: tribe.color }]} />
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          onEndEditing={commitName}
          onSubmitEditing={commitName}
          maxLength={LIMITS.tribeName}
          placeholder="Tribe name"
          placeholderTextColor={colors.textDim}
          returnKeyType="done"
        />
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
      <View style={styles.swatches}>
        {TRIBE_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => saveTribe(tribe.id, { name: tribe.name, color: c })}
            style={[styles.swatch, { backgroundColor: c }, tribe.color.toUpperCase() === c && styles.swatchOn]}
            accessibilityLabel={`Color ${c}`}
          />
        ))}
      </View>
    </Panel>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backBar: { paddingHorizontal: 20, backgroundColor: colors.bg, zIndex: 11 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 60, gap: 12 },
  sectionTitle: { color: colors.accent, fontSize: 15, fontWeight: '800', marginTop: 8 },
  hint: { color: colors.textDim, fontSize: 12.5 },
  tribeCard: { borderWidth: 2, gap: 12 },
  tribeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  nameInput: {
    flex: 1, color: colors.text, fontSize: 17, fontWeight: '700',
    borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 4,
  },
  remove: { color: colors.red, fontSize: 13, fontWeight: '700' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.text, transform: [{ scale: 1.12 }] },
  addBtn: {
    borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  addText: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  castPanel: { gap: 0, paddingVertical: 4 },
  castRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
  castRowFirst: { borderTopWidth: 0 },
  photo: { width: 32, height: 32, borderRadius: 16 },
  castName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  castOut: { textDecorationLine: 'line-through', color: colors.textDim },
  chips: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, maxWidth: 110 },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
