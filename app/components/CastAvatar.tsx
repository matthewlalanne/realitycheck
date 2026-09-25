import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { useLeague } from '../contexts/LeagueContext';
import { tribeOf, textOnTribe } from '../lib/tribes';

// A castaway's picture. Reality Check ships no network photos (they're CBS's);
// a league can upload its own later (`photoUrl`), and until then every
// castaway gets their initials on their tribe's colour — which has to look
// good on its own, because it's the default.
export default function CastAvatar({ id, style, photoUrl }: { id: string; style?: StyleProp<ImageStyle>; photoUrl?: string | null }) {
  const { root, league } = useLeague();
  const uploaded = photoUrl ?? league?.castPhotos?.[id];
  if (uploaded) return <Image source={{ uri: uploaded }} style={style} />;

  const c = root.contestants?.find((x) => x?.id === id);
  const name = c?.name ?? id;
  const nick = name.match(/["“]([^"”]+)["”]/)?.[1];
  const parts = (nick ?? name).trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (nick ? '' : parts[parts.length - 1]?.[0] ?? '')).toUpperCase();

  const color = tribeOf(root, id)?.color ?? '#6B7B8C';
  const flat = StyleSheet.flatten(style) ?? {};
  const h = typeof flat.height === 'number' ? flat.height : typeof flat.width === 'number' ? flat.width : 120;
  return (
    <View style={[style as object, styles.box, { backgroundColor: color }]}>
      <Text style={[styles.text, { color: textOnTribe(color), fontSize: Math.max(11, Math.round(h * 0.38)) }]} numberOfLines={1}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { fontWeight: '800', letterSpacing: 0.5 },
});
