import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { useLinkPreview } from '../lib/linkPreview';

// The card under a chat message that carries a link. It renders nothing at
// all until the page has been read — a skeleton would make every bubble jump
// as the chat scrolls, which is worse than the card simply appearing.
export default function LinkPreview({ url, onPress }: { url: string; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const preview = useLinkPreview(url);
  // A dead image URL is common enough — the card keeps its text instead.
  const [imageBroken, setImageBroken] = useState(false);

  if (!preview) return null;
  const showImage = !!preview.image && !imageBroken;

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="link"
      accessibilityLabel={`${preview.title ?? preview.host}. Opens ${preview.host}.`}
    >
      {showImage && (
        <Image
          source={{ uri: preview.image }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageBroken(true)}
        />
      )}
      <View style={styles.body}>
        <Text style={styles.host} numberOfLines={1}>{preview.host.toUpperCase()}</Text>
        {!!preview.title && <Text style={styles.title} numberOfLines={2}>{preview.title}</Text>}
        {!!preview.description && (
          <Text style={styles.description} numberOfLines={2}>{preview.description}</Text>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  // Panel colours rather than the bubble's own, so the card reads the same on
  // your accent-filled bubble as it does on someone else's.
  card: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  image: { width: '100%', height: 120, backgroundColor: colors.bg2 },
  body: { paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  host: { color: colors.accent2, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  description: { color: colors.textDim, fontSize: 11.5, lineHeight: 15 },
});
