import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../contexts/ThemeContext';
import { useLeague } from '../contexts/LeagueContext';
import type { ColorScheme } from '../theme';

// Breathing room below the notch / Dynamic Island. Phones without one report
// a much smaller inset, so the floor keeps those from feeling cramped too.
export const HEADER_TOP_GAP = 14;

// Breathing room *below* the pinned header, for the scroll content that
// passes under it. Without it the first card sits flush against the fixed
// section's shadow and reads as stuck to it rather than scrolling beneath.
export const CONTENT_TOP_GAP = 20;

export function useTopInset() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 20) + HEADER_TOP_GAP;
}

// Every tab screen renders this, which is what puts the league dropdown in
// the same place on every page for people who play in more than one.
//
// `topInset` must be turned off on any screen that already renders a
// BackButton, since that clears the notch itself — otherwise the two stack up
// and the title sits miles down the page.
export default function ScreenHeader({
  title,
  subtitle,
  topInset = true,
}: {
  title: string;
  subtitle?: string;
  topInset?: boolean;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const inset = useTopInset();
  const top = topInset ? inset : 0;
  const { root, leagueKey, myLeagueKeys, canSwitchLeagues, setLeagueKey, onExitLeague } = useLeague();
  const [open, setOpen] = useState(false);

  const currentName = root.leagues[leagueKey]?.name ?? leagueKey;

  return (
    <View style={[styles.wrap, { paddingTop: top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {(canSwitchLeagues || !!onExitLeague) && (
          <Pressable
            style={styles.trigger}
            onPress={() => setOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`League: ${currentName}. Tap to switch.`}
          >
            <Text style={styles.triggerText}>Switch league</Text>
            <Ionicons name="chevron-down" size={14} color={colors.accent} />
          </Pressable>
        )}
      </View>
      {/* Which league you're in, on every page — no descriptive body copy. A
          screen that names its own content (a recap's title) passes it as
          `subtitle` instead. */}
      <Text style={styles.leagueName} numberOfLines={1}>{subtitle ?? currentName}</Text>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Backdrop doubles as the dismiss target, the way a menu should behave. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Anchored to the trigger's real screen position, which is the
              safe-area inset regardless of whether this header adds it. */}
          <View style={[styles.menu, { top: inset + 42 }]}>
            {myLeagueKeys.map((k) => {
              const on = k === leagueKey;
              return (
                <Pressable
                  key={k}
                  style={[styles.item, on && styles.itemOn]}
                  onPress={() => { setLeagueKey(k); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.itemText, on && styles.itemTextOn, { flexShrink: 1 }]} numberOfLines={1}>
                    {root.leagues[k]?.name ?? k}
                  </Text>
                  {on && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </Pressable>
              );
            })}
            {onExitLeague && (
              <Pressable
                style={[styles.item, styles.allItem]}
                onPress={() => { setOpen(false); onExitLeague(); }}
                accessibilityRole="button"
              >
                <Ionicons name="grid-outline" size={16} color={colors.accent2} />
                <Text style={[styles.itemText, { color: colors.accent2 }]} numberOfLines={1}>All leagues · create or join</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * ScreenHeader locked above a scroll area instead of scrolling away with the
 * content. It carries the same 20px gutter the scroll content uses, so the
 * title sits exactly where it did when it was the list's first row.
 */
export function PinnedHeader(props: { title: string; subtitle?: string; topInset?: boolean }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.pinned, { backgroundColor: colors.bg }]}>
      <ScreenHeader {...props} />
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  wrap: { marginBottom: 18 },
  // Lifts the fixed title off the page so content reads as passing underneath
  // it. Needs its own opaque background (a shadow has nothing to cast from
  // otherwise) and to sit above the scroll view, which comes after it in the
  // tree and would otherwise paint over the shadow.
  pinned: {
    paddingHorizontal: 20,
    zIndex: 10,
    // Tinted with the theme instead of pure black, so the shade reads as part
    // of the palette rather than a grey bar laid over it.
    //
    // iOS spreads a shadow evenly around the shape, so without care it leaks
    // ABOVE the header as well as below — invisible on a tab screen, where
    // that edge is off the top of the display, but on any screen with a Back
    // button above it (Draft, My board) it drew a grey band across the full
    // width, reading as a seam rather than a shadow.
    //
    // The offset is double the radius because the blur reaches roughly twice
    // its nominal radius in practice: measured off a screenshot, radius 9
    // spilled about 8pt past the edge, not 9 minus the offset. At 5/10 the
    // whole blur starts below the header's own top edge, so there is nothing
    // to leak. The Back button's bar covers that strip as well — see the
    // `backBar` style on those screens.
    // Orchid rather than grey, so on the light theme the header's edge reads
    // as a soft glow instead of a smudge.
    shadowColor: colors.accent2,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', flexShrink: 1 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexShrink: 0,
  },
  triggerText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  leagueName: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  menu: {
    position: 'absolute',
    right: 20,
    minWidth: 220,
    // Sized to its longest item so every league/action fits on one line.
    maxWidth: '92%',
    backgroundColor: colors.panel2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  allItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 8, justifyContent: 'flex-start' },
  itemOn: { backgroundColor: colors.bg2 },
  itemText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  itemTextOn: { color: colors.text, fontWeight: '800' },
});
