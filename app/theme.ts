// Theme system: four complete palettes (jungle green, ember orange, deep
// blue, black & white), each with a light and dark variant, crossed with a
// light/dark/auto mode. A theme drives the whole screen — background,
// surfaces, borders and text — not just the accent, so switching themes
// changes the feel of the app rather than recoloring a few buttons.
//
// Green + dark is the original "Fiji jungle camp" look the app shipped with,
// and stays the default.
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemeColor = 'green' | 'orange' | 'blue' | 'purple' | 'mono';

export type ColorScheme = {
  bg: string;        // screen background
  bg2: string;       // inset surfaces: tab bar, input wells, chips
  panel: string;     // cards
  panel2: string;    // raised/highlighted cards
  line: string;      // borders and dividers
  text: string;      // primary text
  textDim: string;   // secondary text
  accent: string;    // primary accent: headings, CTAs, active states
  accent2: string;   // secondary accent: links, labels, back buttons
  onAccent: string;  // text/icons sitting on top of `accent`
  accentOnDark: string; // accent legible over the splash photo, any mode
  scrim: string;     // modal backdrop
  photoScrim: string;// overlay on the sunset photo — theme-tinted, always dark
  shadow: string;    // drop shadows, tinted with the theme rather than pure black
  red: string;       // errors, eliminated
  green: string;     // success, still alive
};

type Palette = Omit<ColorScheme, 'red' | 'green' | 'scrim' | 'accentOnDark' | 'photoScrim' | 'shadow'>;

// Errors and "still alive" stay semantic across every theme — only the
// mode shifts them — because people need to read them as status, not style.
const DARK_SEMANTIC = { red: '#ef7a63', green: '#78c25f', scrim: 'rgba(0,0,0,0.72)' };
const LIGHT_SEMANTIC = { red: '#b23a1e', green: '#2f7d33', scrim: 'rgba(15,20,15,0.45)' };

const THEMES: Record<ThemeColor, { label: string; dark: Palette; light: Palette }> = {
  green: {
    label: 'Jungle',
    dark: {
      bg: '#122720', bg2: '#1a3327', panel: '#1f3d2d', panel2: '#294d38', line: '#3c5744',
      text: '#f4efe0', textDim: '#a7b89a',
      accent: '#f0d9a8', accent2: '#4fb8a8', onAccent: '#1f2d12',
    },
    light: {
      bg: '#f3f7ec', bg2: '#e6eedb', panel: '#ffffff', panel2: '#eef4e4', line: '#cedcbf',
      text: '#15261a', textDim: '#55684f',
      accent: '#2c7a4b', accent2: '#1d7f70', onAccent: '#ffffff',
    },
  },
  orange: {
    label: 'Ember',
    dark: {
      bg: '#1e1610', bg2: '#291d15', panel: '#31231a', panel2: '#3e2c21', line: '#563e2e',
      text: '#f9f0e6', textDim: '#c3a894',
      accent: '#ffb866', accent2: '#f0805a', onAccent: '#2a1608',
    },
    light: {
      bg: '#fdf6ed', bg2: '#f6e8d7', panel: '#ffffff', panel2: '#faf0e3', line: '#e7d3ba',
      text: '#2a1b10', textDim: '#6d5645',
      accent: '#b85a10', accent2: '#b4442a', onAccent: '#ffffff',
    },
  },
  blue: {
    label: 'Deep Water',
    dark: {
      bg: '#0d1a2b', bg2: '#132437', panel: '#192d44', panel2: '#213a56', line: '#33506e',
      text: '#eaf2fb', textDim: '#9cb2cb',
      accent: '#8cc5ff', accent2: '#45c8bf', onAccent: '#06182c',
    },
    light: {
      bg: '#f2f6fc', bg2: '#e2ecf8', panel: '#ffffff', panel2: '#edf3fb', line: '#c7d8ec',
      text: '#0f202f', textDim: '#4e6478',
      accent: '#1a5fa8', accent2: '#0f7d74', onAccent: '#ffffff',
    },
  },
  // Alpenglow: the rose, red-orange and purple-pink light on snow just
  // after sunset. Both modes share one hue family — red-orange leads, orchid
  // follows — only the lightness flips. Cards are translucent so the
  // sky-to-glow gradient behind every screen (App.tsx) shows through them;
  // bg2/panel2 stay opaque because sheets and menus sit on top of content.
  purple: {
    label: 'Alpenglow',
    dark: {
      bg: '#1a1233', bg2: '#251a42', panel: 'rgba(255,226,236,0.07)', panel2: '#33224f', line: 'rgba(255,196,214,0.16)',
      text: '#fff1ee', textDim: '#c7b3cf',
      accent: '#ff8f73', accent2: '#e98cc4', onAccent: '#2a1024',
    },
    light: {
      bg: '#fdf4f1', bg2: '#f9e8e6', panel: 'rgba(255,255,255,0.72)', panel2: '#ffffff', line: 'rgba(176,72,110,0.16)',
      text: '#2b1732', textDim: '#7c6178',
      accent: '#cf4a35', accent2: '#a8478f', onAccent: '#ffffff',
    },
  },
  mono: {
    label: 'Black & White',
    dark: {
      bg: '#0d0d0d', bg2: '#171717', panel: '#1d1d1d', panel2: '#272727', line: '#3b3b3b',
      text: '#f5f5f5', textDim: '#a3a3a3',
      accent: '#ffffff', accent2: '#c2c2c2', onAccent: '#0d0d0d',
    },
    light: {
      bg: '#f6f6f6', bg2: '#ececec', panel: '#ffffff', panel2: '#f0f0f0', line: '#d6d6d6',
      text: '#0f0f0f', textDim: '#5c5c5c',
      accent: '#1a1a1a', accent2: '#4a4a4a', onAccent: '#ffffff',
    },
  },
};

// Drives the picker — a palette missing from this list is invisible in the UI
// no matter that it exists in THEMES.
// Alpenglow leads the list and is the default — it's the brand theme.
export const THEME_ORDER: ThemeColor[] = ['purple', 'green', 'orange', 'blue', 'mono'];

export const THEME_OPTIONS = THEME_ORDER.map((key) => ({
  key,
  label: THEMES[key].label,
  dark: buildColors('dark', key),
  light: buildColors('light', key),
}));

/**
 * Takes a palette colour and drops it most of the way to black, keeping its
 * hue. Overlays on the sunset photo and drop shadows both have to stay dark in
 * every mode — a light-mode tint would wash the scrim out and leave the light
 * type on the photo unreadable — so these are always derived from the theme's
 * DARK background, the same trick accentOnDark uses.
 */
function nearBlack(hex: string, factor: number, alpha?: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return alpha === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildColors(mode: 'light' | 'dark', theme: ThemeColor): ColorScheme {
  const t = THEMES[theme];
  const palette = mode === 'dark' ? t.dark : t.light;
  const semantic = mode === 'dark' ? DARK_SEMANTIC : LIGHT_SEMANTIC;
  return {
    ...palette,
    ...semantic,
    accentOnDark: t.dark.accent,
    photoScrim: nearBlack(t.dark.bg, 0.55, 0.62),
    shadow: nearBlack(t.dark.bg, 0.3),
  };
}

// Wordmark font — Anton, the same bold condensed display face used for the
// "SURVIVOR" title on the web league site, for a consistent brand feel.
export const wordmarkFont = 'Anton_400Regular';
