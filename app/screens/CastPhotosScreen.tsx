import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import CastAvatar from '../components/CastAvatar';
import { useLeague } from '../contexts/LeagueContext';
import { pickAndStoreCastPhoto } from '../lib/avatars';

type Props = NativeStackScreenProps<RootStackParamList, 'CastPhotos'>;

// A setup step, not just a per-bio afterthought: upload every cast photo in
// one pass instead of visiting each Bio page one at a time. Shown right
// after creating a league (App.tsx), and reachable again any time from
// Settings > Commissioner Tools.
export default function CastPhotosScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { root, league, leagueKey } = useLeague();
  const contestants = [...(root.contestants || [])].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // Setup mode (right after creating a league) ends at MainTabs with a "Done"
  // CTA; opened later from Settings it's just a normal page you back out of.
  const setup = !!route.params?.setup;

  const upload = async (id: string) => {
    setUploadingId(id);
    try { await pickAndStoreCastPhoto(leagueKey, id); } finally { setUploadingId(null); }
  };

  const finish = () => navigation.replace('MainTabs');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {setup ? (
          <Pressable onPress={finish} hitSlop={10}><Text style={styles.skip}>Skip for now</Text></Pressable>
        ) : (
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.accent2} />
          </Pressable>
        )}
        <View />
      </View>
      <Text style={styles.title}>Add cast photos</Text>
      <Text style={styles.subtitle}>
        {setup
          ? `${league.name} ships with initials on tribe colors until you add real photos. Tap anyone below, or skip and do it later from Settings.`
          : 'Tap anyone to add or change their photo.'}
      </Text>
      <FlatList
        contentContainerStyle={styles.list}
        data={contestants}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => upload(item.id)} disabled={uploadingId === item.id}>
            <CastAvatar id={item.id} style={styles.photo} />
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {uploadingId === item.id ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.action}>{league.castPhotos?.[item.id] ? 'Change' : 'Add'}</Text>
            )}
          </Pressable>
        )}
      />
      {setup && (
        <Panel style={styles.doneBar}>
          <Pressable style={styles.doneBtn} onPress={finish}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </Panel>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 4 },
  skip: { color: colors.accent2, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 8 },
  subtitle: { color: colors.textDim, fontSize: 13.5, lineHeight: 19, marginTop: 4, marginBottom: 12 },
  list: { gap: 8, paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg2, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line,
  },
  photo: { width: 44, height: 44, borderRadius: 22 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  action: { color: colors.accent, fontSize: 13.5, fontWeight: '700' },
  doneBar: { position: 'absolute', left: 20, right: 20, bottom: 30, backgroundColor: colors.panel2 },
  doneBtn: { alignItems: 'center', paddingVertical: 12 },
  doneBtnText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});
