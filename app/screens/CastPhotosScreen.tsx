import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import CastAvatar from '../components/CastAvatar';
import { Screen } from './onboarding/ui';
import { useLeague } from '../contexts/LeagueContext';
import { pickAndStoreCastPhoto } from '../lib/avatars';

type Props = NativeStackScreenProps<RootStackParamList, 'CastPhotos'>;

// Upload every cast photo in one pass instead of one Bio page at a time.
// Shown right after creating a league (App.tsx) and from Settings. Uses the
// same Screen frame as league setup so the buttons match those steps.
export default function CastPhotosScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { root, league, leagueKey, terms } = useLeague();
  const contestants = [...(root.contestants || [])].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const setup = !!route.params?.setup;

  const upload = async (id: string) => {
    setUploadingId(id);
    try { await pickAndStoreCastPhoto(leagueKey, id); } finally { setUploadingId(null); }
  };

  const finish = () => (setup ? navigation.replace('MainTabs') : navigation.goBack());

  return (
    <Screen
      title="Cast photos & bios"
      subtitle={`Until you add photos, ${terms.units} show as initials. Add photo and Add bio are separate — tap either one.`}
      onBack={setup ? undefined : () => navigation.goBack()}
      primary={{ label: 'Done', onPress: finish }}
      secondary={setup ? { label: 'Skip for now', onPress: finish } : undefined}
    >
      <View style={styles.list}>
        {contestants.map((c) => (
          <View key={c.id} style={styles.row}>
            <CastAvatar id={c.id} style={styles.photo} />
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
            {/* Two separate actions, each its own chip — side by side plain
                text read as one phrase ("Add Bio") instead of two taps. */}
            <View style={styles.actions}>
              <Pressable style={styles.actionChip} onPress={() => upload(c.id)} disabled={uploadingId === c.id} hitSlop={4}>
                {uploadingId === c.id ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={13} color={colors.accent} />
                    <Text style={styles.action}>{league.castPhotos?.[c.id] ? 'Edit photo' : 'Add photo'}</Text>
                  </>
                )}
              </Pressable>
              {/* Bio text is written on the bio page itself (commissioners get an Edit bio button there). */}
              <Pressable style={styles.actionChip} onPress={() => navigation.navigate('Bio', { id: c.id })} hitSlop={4}>
                <Ionicons name="create-outline" size={13} color={colors.accent2} />
                <Text style={[styles.action, { color: colors.accent2 }]}>{league.castBios?.[c.id] ? 'Edit bio' : 'Add bio'}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, backgroundColor: colors.bg2, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line,
  },
  photo: { width: 44, height: 44, borderRadius: 22 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, minWidth: 90 },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 56, flexBasis: '100%' },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg,
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, minHeight: 28,
  },
  action: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
});
