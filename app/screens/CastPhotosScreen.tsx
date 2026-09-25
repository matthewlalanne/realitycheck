import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
      title="Add cast photos"
      subtitle={`Until you add photos, ${terms.units} show as initials. Tap anyone to add theirs.`}
      onBack={setup ? undefined : () => navigation.goBack()}
      primary={{ label: 'Done', onPress: finish }}
      secondary={setup ? { label: 'Skip for now', onPress: finish } : undefined}
    >
      <View style={styles.list}>
        {contestants.map((c) => (
          <Pressable key={c.id} style={styles.row} onPress={() => upload(c.id)} disabled={uploadingId === c.id}>
            <CastAvatar id={c.id} style={styles.photo} />
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
            {uploadingId === c.id ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.action}>{league.castPhotos?.[c.id] ? 'Change' : 'Add'}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg2, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line,
  },
  photo: { width: 44, height: 44, borderRadius: 22 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  action: { color: colors.accent, fontSize: 13.5, fontWeight: '700' },
});
