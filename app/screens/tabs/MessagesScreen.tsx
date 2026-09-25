import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Clipboard,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import { PinnedHeader, CONTENT_TOP_GAP } from '../../components/ScreenHeader';
import { useLeague } from '../../contexts/LeagueContext';
import { messagesFor, reactionSummary, reactorsOf, sendGif, sendMessage, toggleReaction } from '../../lib/state';
import GifPicker from '../../components/GifPicker';
import type { Gif } from '../../lib/gifs';
import { Image as ExpoImage } from 'expo-image';
import { LIMITS } from '../../lib/limits';
import Avatar from '../../components/Avatar';
import { avatarFor, useAvatars } from '../../lib/avatars';
import { useSeen } from '../../lib/seen';
import { dividerLabel, messageTime } from '../../lib/chatTime';
import { firstLink, linkify } from '../../lib/linkify';
import { useTypingOthers, useTypingSignal } from '../../lib/typing';
import TypingBubble from '../../components/TypingBubble';
import ReadReceipt from '../../components/ReadReceipt';
import LinkPreview from '../../components/LinkPreview';
import { readersOf, useMarkRead, useReads } from '../../lib/reads';
import { peopleOf } from '../../lib/state';

// Small, deliberately Survivor-flavoured set — a long picker would be more
// friction than the trash talk is worth.
// How far the conversation slides to reveal times. The stamp has to park far
// enough out that the list's own horizontal padding doesn't leave it peeking.
const TIME_GUTTER = 68;
const STAMP_W = 40;
const LIST_PAD = 20;
const PALETTE_H = 54; // floating reaction palette
const WHO_MAX_H = 190; // reactor list scrolls past this
// Composer height, driven by hand: iOS doesn't re-measure a multiline field
// when its value is cleared in code, so after sending a two-line message the
// box stayed two lines tall with nothing in it.
const INPUT_MIN = 40;
const INPUT_MAX = 120;

const REACTIONS = ['\u{1F44D}', '\u{1F525}', '\u{1F602}', '\u{1F62E}', '\u{1F480}', '\u{1F3C6}', '\u{2764}\u{FE0F}'];

// League-wide group chat, stored in the shared league record — live for
// everyone in the league. Switching leagues in the header switches the chat.
export default function MessagesScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { root, leagueKey, league, playerId, playerName } = useLeague();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const messages = messagesFor(root, leagueKey);
  const avatars = useAvatars();
  const [draft, setDraft] = useState('');
  const [inputH, setInputH] = useState(INPUT_MIN);
  const [keyboardUp, setKeyboardUp] = useState(false);
  // Measured on long-press so the palette can be anchored over the bubble.
  // Floating it in a Modal is also what makes it work on the newest message —
  // inline, the palette rendered under the input bar and was unreachable.
  const [picker, setPicker] = useState<
    { id: string; top: number; height: number; mine: boolean } | null
  >(null);
  const bubbleRefs = useRef(new Map<string, View | null>()).current;
  const { height: screenH } = useWindowDimensions();

  // Typing presence. Names are resolved from the roster so a person id alone
  // is enough to store.
  // Read receipts: shared, unlike the device-local unread dot in lib/seen.ts.
  const reads = useReads(leagueKey);
  const markRead = useMarkRead(leagueKey, playerId);
  // Only your own newest message carries a receipt, as in Messages.
  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].authorId === playerId) return messages[i].id;
    }
    return null;
  }, [messages, playerId]);

  const typingIds = useTypingOthers(leagueKey, playerId);
  const { beat, stop: stopTyping } = useTypingSignal(leagueKey, playerId);
  const typingPeople = useMemo(() => {
    const byId = new Map(peopleOf(league).map((m) => [m.id, m.name]));
    return typingIds.map((id) => ({ id, name: byId.get(id) || id }));
  }, [typingIds, league]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  // One-line confirmation for actions with no visible result of their own —
  // copying, or a link the phone has nothing to open with.
  const [toast, setToast] = useState<string | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function flash(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastFade.setValue(0);
    Animated.timing(toastFade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastFade, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        ({ finished }) => { if (finished) setToast(null); },
      );
    }, 1300);
  }

  function copyMessage(text: string) {
    Clipboard.setString(text);
    setPicker(null);
    flash('Copied');
  }

  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      flash("Couldn't open that link");
    }
  }

  // Drag the whole conversation left to reveal each message's time in the
  // gutter, like Messages. One shared Animated value drives every row.
  const reveal = useRef(new Animated.Value(0)).current;
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim horizontal drags only, so vertical scrolling is untouched.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderMove: (_e, g) => {
          const x = Math.max(-TIME_GUTTER, Math.min(0, g.dx));
          reveal.setValue(x);
        },
        onPanResponderRelease: () => {
          Animated.spring(reveal, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(reveal, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [reveal],
  );
  const { markSeen } = useSeen('messages', leagueKey);

  // Mark read on focus, and again as messages land while you're sitting in the
  // chat — otherwise the badge would pop up for a message already on screen.
  // Bottom tabs keep this screen mounted while you're elsewhere in the app, so
  // marking read has to be gated on actually being focused — otherwise every
  // incoming message would clear the badge from behind another tab.
  //
  // Mark up to the newest message we hold rather than just "now": these
  // timestamps come off the sender's clock, so one running fast would leave a
  // message permanently newer than our last-seen time and stick the dot on.
  const isFocused = useIsFocused();
  const newest = messages.length ? messages[messages.length - 1].createdAt : 0;
  useEffect(() => {
    if (!isFocused) return;
    markSeen(Math.max(newest, Date.now()));
    markRead();
  }, [isFocused, newest, markSeen, markRead]);

  function openPicker(id: string, mine: boolean) {
    const node = bubbleRefs.get(id);
    if (!node) return;
    // The tap Messages gives you when the palette appears. Fire-and-forget:
    // a phone with haptics switched off, or none at all, just doesn't buzz.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    node.measureInWindow((_x, y, _w, h) => setPicker({ id, top: y, height: h, mine }));
  }

  const [gifOpen, setGifOpen] = useState(false);

  async function pickGif(gif: Gif) {
    try {
      await sendGif(leagueKey, playerId, playerName, gif);
    } catch {
      // Same posture as a failed message: the chat simply doesn't gain it.
    }
  }

  async function send() {
    stopTyping();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setInputH(INPUT_MIN);
    setSending(true);
    try {
      await sendMessage(leagueKey, playerId, playerName, text);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } finally {
      setSending(false);
    }
  }

  return (
    // No keyboardVerticalOffset: the tab navigator already excludes the tab
    // bar from this screen's frame, so KeyboardAvoidingView measures from
    // above it. Adding the tab bar height here counted it twice and left a
    // gap the exact size of the tab bar between the composer and the keyboard.
    <KeyboardAvoidingView
      style={styles.keyboardLayer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={styles.listWrap} {...pan.panHandlers}>
      <PinnedHeader title="Chat" />
      <FlatList
        onScrollBeginDrag={() => { if (picker) setPicker(null); }}
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={styles.emptyText}>No messages yet — say hi.</Text>}
        renderItem={({ item, index }) => {
          const divider = dividerLabel(item.createdAt, index > 0 ? messages[index - 1].createdAt : null);
          const mine = item.authorId === playerId;
          const reactions = reactionSummary(item, playerId);
          return (
            <View>
              {!!divider && (
                <View style={styles.divider}>
                  <Text style={styles.dividerText}>{divider}</Text>
                </View>
              )}
              <Animated.View style={[styles.messageBlock, { transform: [{ translateX: reveal }] }]}>
                <Text style={styles.stamp} numberOfLines={1}>{messageTime(item.createdAt)}</Text>
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                {!mine && (
                  <Pressable onPress={() => navigation.navigate('TeamProfile', { playerId: item.authorId })} hitSlop={6}>
                    <Avatar
                      name={item.authorName}
                      color={colors.accent2}
                      size={28}
                      uri={avatarFor(avatars, item.authorId, [], leagueKey)}
                    />
                  </Pressable>
                )}
                <Pressable
                  ref={(node) => { bubbleRefs.set(item.id, node); }}
                  onLongPress={() => openPicker(item.id, mine)}
                  delayLongPress={220}
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                    // The chosen message stays lit while the palette is open,
                    // the way Messages dims everything else.
                    picker?.id === item.id && styles.bubbleActive,
                  ]}
                  accessibilityHint="Press and hold to react"
                >
                  {!mine && (
                    <Text style={styles.author} onPress={() => navigation.navigate('TeamProfile', { playerId: item.authorId })}>
                      {item.authorName}
                    </Text>
                  )}
                  {item.gif ? (
                    // Sized from the GIF's own proportions, capped so a tall
                    // one can't take over the screen.
                    <ExpoImage
                      source={{ uri: item.gif.url }}
                      style={[
                        styles.gif,
                        {
                          height: Math.round(
                            Math.min(
                              220,
                              GIF_BUBBLE_W /
                                Math.max((item.gif.width || 1) / (item.gif.height || 1), 0.6),
                            ),
                          ),
                        },
                      ]}
                      contentFit="cover"
                      transition={120}
                      accessibilityLabel={item.gif.title || 'GIF'}
                    />
                  ) : null}
                  {item.text ? (
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {linkify(item.text).map((part, i) =>
                      part.url ? (
                        // Long-press has to be repeated here: the link handles
                        // the press itself, so the bubble underneath never
                        // sees it and reactions would die on top of a link.
                        <Text
                          key={i}
                          style={[styles.link, mine && styles.linkMine]}
                          onPress={() => openLink(part.url!)}
                          onLongPress={() => openPicker(item.id, mine)}
                        >
                          {part.text}
                        </Text>
                      ) : (
                        part.text
                      ),
                    )}
                  </Text>
                  ) : null}
                  {(() => {
                    // Only the first link gets a card, as in Messages — a
                    // bubble with three links would otherwise be a wall of
                    // thumbnails.
                    const link = firstLink(item.text);
                    return link ? <LinkPreview url={link} onPress={() => openLink(link)} /> : null;
                  })()}
                </Pressable>
                </View>

              {item.id === lastMineId && (() => {
                const ids = readersOf(reads, item.createdAt, playerId);
                const byId = new Map(peopleOf(league).map((m) => [m.id, m.name]));
                return (
                  <ReadReceipt
                    readers={ids.map((id) => ({ id, name: byId.get(id) || id }))}
                    avatars={avatars}
                    leagueKey={leagueKey}
                  />
                );
              })()}

              {!!reactions.length && (
                <View style={[styles.chips, mine && styles.chipsMine]}>
                  {reactions.map((r) => (
                    <Pressable
                      key={r.emoji}
                      onPress={() => toggleReaction(leagueKey, item.id, r.emoji, playerId, !r.mine)}
                      style={[styles.chip, r.mine && styles.chipMine]}
                    >
                      <Text style={styles.chipEmoji}>{r.emoji}</Text>
                      <Text style={[styles.chipCount, r.mine && styles.chipCountMine]}>{r.count}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              </Animated.View>
            </View>
          );
        }}
      />
      </Animated.View>

      <TypingBubble people={typingPeople} avatars={avatars} leagueKey={leagueKey} />

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          {!!picker && (() => {
            const msg = messages.find((m) => m.id === picker.id);
            const chosen = msg ? reactionSummary(msg, playerId) : [];
            // Prefer sitting above the bubble; drop below when it's near the
            // top of the screen, and keep clear of both edges.
            const above = picker.top > 140;
            const top = above
              ? Math.max(48, picker.top - PALETTE_H - 10)
              : Math.min(screenH - PALETTE_H - 48, picker.top + picker.height + 10);
            const who = msg ? reactorsOf(msg) : [];
            const byId = new Map(peopleOf(league).map((m) => [m.id, m.name]));
            // Where the list of reactors goes. It never covers the bubble:
            // above the palette when there's room overhead, otherwise on the
            // bubble's other side. Anchoring by the edge it grows away from
            // means its height doesn't have to be known in advance.
            const whoUp = above && top > WHO_MAX_H + 60;
            const whoTop = above ? picker.top + picker.height + 10 : top + PALETTE_H + 8;
            return (
              <>
              {!!who.length && (
                // A Pressable that does nothing, so a tap meant for the list
                // isn't caught by the backdrop and read as "dismiss".
                <Pressable
                  onPress={() => {}}
                  style={[
                    styles.who,
                    picker.mine ? styles.paletteRight : styles.paletteLeft,
                    whoUp ? { bottom: screenH - top + 8 } : { top: whoTop },
                  ]}
                >
                  <ScrollView
                    style={{
                      maxHeight: whoUp
                        ? WHO_MAX_H
                        : Math.max(60, Math.min(WHO_MAX_H, screenH - whoTop - 90)),
                    }}
                    showsVerticalScrollIndicator={false}
                  >
                    {who.map((r, i) => {
                      const name = byId.get(r.id) || r.id;
                      return (
                        <View key={`${r.id}-${r.emoji}`} style={[styles.whoRow, i > 0 && styles.whoRowNext]}>
                          <Avatar
                            name={name}
                            color={colors.accent2}
                            size={22}
                            uri={avatarFor(avatars, r.id, [], leagueKey)}
                          />
                          <Text style={styles.whoName} numberOfLines={1}>
                            {r.id === playerId ? 'You' : name}
                          </Text>
                          <Text style={styles.whoEmoji}>{r.emoji}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </Pressable>
              )}
              <View
                style={[
                  styles.palette,
                  { top },
                  picker.mine ? styles.paletteRight : styles.paletteLeft,
                ]}
              >
                {!!msg && (
                  <>
                    <Pressable
                      onPress={() => copyMessage(msg.text)}
                      style={styles.paletteItem}
                      accessibilityLabel="Copy message text"
                    >
                      <Ionicons name="copy-outline" size={21} color={colors.text} />
                    </Pressable>
                    <View style={styles.paletteSplit} />
                  </>
                )}
                {REACTIONS.map((emoji) => {
                  const on = chosen.some((r) => r.emoji === emoji && r.mine);
                  return (
                    <Pressable
                      key={emoji}
                      onPress={() => {
                        toggleReaction(leagueKey, picker.id, emoji, playerId, !on);
                        setPicker(null);
                      }}
                      style={[styles.paletteItem, on && styles.paletteItemOn]}
                      accessibilityLabel={`React with ${emoji}`}
                    >
                      <Text style={styles.paletteEmoji}>{emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
              </>
            );
          })()}
        </Pressable>
      </Modal>

      {!!toast && (
        <Animated.View style={[styles.toast, { opacity: toastFade }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}

      <View style={styles.inputBar}>
        {keyboardUp && (
          <Pressable
            onPress={Keyboard.dismiss}
            style={styles.dismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close keyboard"
          >
            <Ionicons name="chevron-down" size={20} color={colors.accent2} />
          </Pressable>
        )}
        <Pressable
          style={styles.gifButton}
          onPress={() => { Keyboard.dismiss(); setGifOpen(true); }}
          hitSlop={8}
          accessibilityLabel="Send a GIF"
        >
          <Text style={styles.gifButtonText}>GIF</Text>
        </Pressable>
        <View style={styles.inputWrap}>
          <TextInput
            style={[
              styles.input,
              { height: Math.min(INPUT_MAX, Math.max(INPUT_MIN, inputH)) },
            ]}
            onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              if (t.trim()) beat(); else stopTyping();
            }}
            onFocus={() => setKeyboardUp(true)}
            onBlur={() => setKeyboardUp(false)}
            placeholder="Message your league..."
            placeholderTextColor={colors.textDim}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
            // Hard stop at the database's own limit. Past it the message can't
            // be stored at all, so it's better to run out of room while typing
            // than to tap Send and have nothing happen.
            maxLength={LIMITS.messageText}
          />
          {draft.length > LIMITS.messageText - 100 && (
            <Text style={styles.counter}>{LIMITS.messageText - draft.length} left</Text>
          )}
        </View>
        <Pressable
          style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonOff]}
          onPress={send}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>

      <GifPicker visible={gifOpen} onClose={() => setGifOpen(false)} onPick={pickGif} />
    </KeyboardAvoidingView>
  );
}

// The widest a bubble gets, which is what a GIF inside one has to fit.
const GIF_BUBBLE_W = 220;

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  // bg2 here so the strip revealed behind the keyboard's rounded corners
  // matches the composer rather than the page.
  keyboardLayer: { flex: 1, backgroundColor: colors.bg2 },
  inputWrap: { flex: 1 },
  // Same 40pt height and pill radius as the send button and the input, so the
  // composer reads as one row rather than three things of different sizes.
  gifButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifButtonText: { color: colors.accent2, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.5 },
  gif: { width: GIF_BUBBLE_W, borderRadius: 12, backgroundColor: colors.bg2 },
  counter: { color: colors.textDim, fontSize: 11, textAlign: 'right', marginTop: 2, marginRight: 4 },
  list: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: 20, paddingTop: CONTENT_TOP_GAP, gap: 10, flexGrow: 1 },
  emptyText: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 20 },
  // Matches the list's own background: the header sits above the list now, so
  // without this it would show the composer layer's colour behind the title.
  listWrap: { flex: 1, backgroundColor: colors.bg },
  // Dim everything but the chosen message, like Messages does.
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  palette: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 2,
    height: PALETTE_H, paddingHorizontal: 8, borderRadius: PALETTE_H / 2,
    backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  paletteLeft: { left: 16 },
  paletteRight: { right: 16 },
  // Trimmed from 7/24 when Copy joined the row: eight controls at the old size
  // ran past the far edge of a 375pt screen, and the palette is pinned to one
  // side so the overflow had nowhere to go.
  paletteItem: { paddingHorizontal: 6, paddingVertical: 8, borderRadius: 18 },
  paletteItemOn: { backgroundColor: colors.accent },
  paletteSplit: { width: 1, height: 26, backgroundColor: colors.line, marginHorizontal: 5 },
  paletteEmoji: { fontSize: 23 },
  who: {
    position: 'absolute', minWidth: 170, maxWidth: 260,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16,
    backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  whoRowNext: { borderTopWidth: 1, borderTopColor: colors.line },
  whoName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  whoEmoji: { fontSize: 16 },
  bubbleActive: { borderColor: colors.accent, borderWidth: 1.5 },
  divider: { alignItems: 'center', paddingVertical: 10 },
  dividerText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  // Parked just outside the right edge; the drag brings it into view.
  // Parked fully off-screen: its left edge starts LIST_PAD + 8 beyond the
  // message block, so the list padding can't reveal a sliver of it at rest.
  stamp: {
    position: 'absolute', top: 2,
    right: -(STAMP_W + LIST_PAD + 8), width: STAMP_W,
    color: colors.textDim, fontSize: 10.5, textAlign: 'left',
  },
  messageBlock: { gap: 4, position: 'relative' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleTheirs: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  bubbleMine: { backgroundColor: colors.accent },
  author: { color: colors.accent2, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { color: colors.text, fontSize: 14 },
  bubbleTextMine: { color: colors.onAccent },
  // accent2 is the theme's link colour, but on your own bubble it sits on the
  // accent fill — there the underline plus the bubble's own text colour reads.
  link: { color: colors.accent2, textDecorationLine: 'underline' },
  linkMine: { color: colors.onAccent },
  toast: {
    position: 'absolute', bottom: 74, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line,
  },
  toastText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignSelf: 'flex-start', marginLeft: 36 },
  chipsMine: { alignSelf: 'flex-end' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line,
  },
  chipMine: { borderColor: colors.accent },
  chipEmoji: { fontSize: 13 },
  chipCount: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  chipCountMine: { color: colors.accent },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg2,
  },
  // 34 wide by 40 tall with a 17 radius was an oval, not a circle. Equal sides
  // and a matching radius make it round, and it sits centred against the
  // composer rather than stretching to the input's height.
  dismiss: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    // Width comes from inputWrap now (which also holds the character counter).
    // Height is passed in from the measured content size (see INPUT_MIN /
    // INPUT_MAX) rather than left to the field itself.
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text,
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 40,
    justifyContent: 'center',
  },
  sendButtonOff: { opacity: 0.45 },
  sendButtonText: { color: colors.onAccent, fontWeight: '700' },
});
