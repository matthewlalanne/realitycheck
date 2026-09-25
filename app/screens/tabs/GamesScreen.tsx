import { useRef, useState } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import SegmentedTabs from '../../components/SegmentedTabs';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import { PinnedHeader, CONTENT_TOP_GAP } from '../../components/ScreenHeader';
import PuzzleGame from '../games/PuzzleGame';
import MemoryGame from '../games/MemoryGame';

export default function GamesScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  // Tapping the tab you're already on jumps back to the top, the way
  // every other iOS app behaves.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [tab, setTab] = useState<'puzzle' | 'memory'>('puzzle');
  const [boardWidth, setBoardWidth] = useState(300);

  function onLayout(e: LayoutChangeEvent) {
    // Subtract the ScrollView's own horizontal padding (20 per side) so the
    // board never overflows past the screen edges.
    setBoardWidth(Math.min(360, e.nativeEvent.layout.width - 40));
  }

  return (
    <View style={styles.container}>
      <PinnedHeader title="Games" />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} onLayout={onLayout}>

      <View style={styles.tabsWrap}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[{ key: 'puzzle', label: 'Puzzle' }, { key: 'memory', label: 'Memory' }]}
        />
      </View>

      {tab === 'puzzle' ? <PuzzleGame boardWidth={boardWidth} /> : <MemoryGame boardWidth={boardWidth} />}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 40 },
  tabsWrap: { marginBottom: 16 },
});
