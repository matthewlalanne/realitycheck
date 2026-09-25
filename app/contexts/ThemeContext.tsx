import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_ORDER, buildColors, type ColorScheme, type ThemeColor, type ThemeMode } from '../theme';

const MODE_KEY = 'outlast.themeMode';
const THEME_KEY = 'outlast.themeAccent';

type ThemeContextValue = {
  colors: ColorScheme;
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  theme: ThemeColor;
  setMode: (m: ThemeMode) => void;
  setTheme: (t: ThemeColor) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Wraps the whole app (above the splash screen) so every screen — including
// the splash — renders in the player's chosen theme from first paint.
// Defaults match the original jungle look, then swap in the saved choice once
// AsyncStorage resolves, rather than holding up the first frame.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const [theme, setThemeState] = useState<ThemeColor>('purple');

  useEffect(() => {
    (async () => {
      const [m, t] = await Promise.all([AsyncStorage.getItem(MODE_KEY), AsyncStorage.getItem(THEME_KEY)]);
      if (m === 'light' || m === 'dark' || m === 'auto') setModeState(m);
      if (t && (THEME_ORDER as string[]).includes(t)) setThemeState(t as ThemeColor);
    })();
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m);
  };
  const setTheme = (t: ThemeColor) => {
    setThemeState(t);
    AsyncStorage.setItem(THEME_KEY, t);
  };

  const resolvedMode: 'light' | 'dark' = mode === 'auto' ? (system === 'light' ? 'light' : 'dark') : mode;
  const colors = useMemo(() => buildColors(resolvedMode, theme), [resolvedMode, theme]);

  return (
    <ThemeContext.Provider value={{ colors, mode, resolvedMode, theme, setMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

export function useThemeColors(): ColorScheme {
  return useTheme().colors;
}
