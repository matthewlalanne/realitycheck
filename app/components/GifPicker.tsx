import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { useGifSearch, type Gif } from '../lib/gifs';

// Two columns of GIFs, trending until you type. expo-image rather than the
// built-in Image because it animates GIFs on Android as well as iOS — that is
// the whole reason this needed a new build.
//
// "Powered by GIPHY" is not decoration: their terms require the attribution
// wherever the API is used.
const GAP = 8;

export default function GifPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (gif: Gif) => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const { gifs, loading, error } = useGifSearch(query, visible);

  const close = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  // Two even columns inside the sheet's 12pt padding.
  const cell = Math.floor((width - 24 - GAP) / 2);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.headRow}>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search GIFs"
              placeholderTextColor={colors.textDim}
              autoCorrect={false}
              returnKeyType="search"
            />
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textDim} />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.state}><Text style={styles.error}>{error}</Text></View>
          ) : loading && !gifs.length ? (
            <View style={styles.state}><ActivityIndicator color={colors.accent} /></View>
          ) : !gifs.length ? (
            <View style={styles.state}>
              <Text style={styles.empty}>{query.trim() ? `Nothing for "${query.trim()}".` : 'No GIFs right now.'}</Text>
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={(g) => g.id}
              numColumns={2}
              columnWrapperStyle={{ gap: GAP }}
              contentContainerStyle={{ gap: GAP, paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                // Keep each GIF's own shape rather than cropping to a square.
                const ratio = item.width && item.height ? item.width / item.height : 1;
                return (
                  <Pressable
                    onPress={() => { onPick(item); close(); }}
                    accessibilityLabel={item.title || 'Send this GIF'}
                  >
                    <Image
                      // The animated one. A still frame gives you no idea what
                      // a GIF actually does, which is the entire point of it —
                      // `thumb` is GIPHY's downsampled animation, small enough
                      // to run two dozen at once.
                      source={{ uri: item.thumb || item.url }}
                      placeholder={item.preview ? { uri: item.preview } : undefined}
                      style={{ width: cell, height: Math.round(cell / Math.max(ratio, 0.5)), borderRadius: 10, backgroundColor: colors.bg2 }}
                      contentFit="cover"
                      transition={120}
                    />
                  </Pressable>
                );
              }}
            />
          )}

          <Text style={styles.attribution}>Powered by GIPHY</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    height: '72%',
    gap: 10,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    color: colors.text,
    fontSize: 15,
  },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.red, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  empty: { color: colors.textDim, fontSize: 13.5, textAlign: 'center' },
  attribution: { color: colors.textDim, fontSize: 10.5, textAlign: 'center', letterSpacing: 0.4 },
});
