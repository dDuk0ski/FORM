import { useColorScheme, type TextStyle } from 'react-native';

// The only file allowed to contain color literals (enforced by eslint.config.js).

const light = {
  background: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEFEC',
  border: '#E2E2DE',
  text: '#16181D',
  textMuted: '#6B6F76',
  primary: '#1F6FEB',
  onPrimary: '#FFFFFF',
  success: '#1A7F37',
  warning: '#9A6700',
  danger: '#CF222E',

  // Figma tokens (sampled from Christian's exports). Added alongside the originals so screens
  // that use the tokens above look the same; restyled screens opt in to these.
  surfaceAlt: '#F9FAFB',
  cardBorder: '#E5E7EB',
  chipBorder: '#D1D5DB',
  primarySoft: '#DDF3DE',
  primarySoftBorder: '#AFC0AF',
  onPrimarySoft: '#111827',
  stepper: '#111827',
  stepperText: '#FFFFFF',
  link: '#15803D',
  progressTrack: '#E5E7EB',
  progressGood: '#85D2BB',
  progressWarning: '#DAC281',
  progressOver: '#F17F81',
  macroProtein: '#99AFED',
  macroCarbs: '#EEC28F',
  macroFat: '#C4A6F7',
  headerHome: '#DDF3DE',
  headerPantry: '#F3DDDD',
  headerRecipes: '#E5DDF3',
  headerProfile: '#DCC0DC',
  shadow: '#000000',
};

export type ColorTokens = typeof light;

const dark: ColorTokens = {
  background: '#0E0F12',
  surface: '#17191E',
  surfaceMuted: '#22252B',
  border: '#2C3038',
  text: '#F2F3F5',
  textMuted: '#9BA1AA',
  primary: '#4C8DFF',
  onPrimary: '#FFFFFF',
  success: '#3FB950',
  warning: '#D29922',
  danger: '#F85149',

  // The Figma file has no dark frames, so these are chosen to match the light set's roles.
  surfaceAlt: '#121418',
  cardBorder: '#2C3038',
  chipBorder: '#3A3F48',
  primarySoft: '#1F3324',
  primarySoftBorder: '#3B5A41',
  onPrimarySoft: '#F2F3F5',
  stepper: '#F2F3F5',
  stepperText: '#111827',
  link: '#4ADE80',
  progressTrack: '#2C3038',
  progressGood: '#5FB8A0',
  progressWarning: '#C9AE62',
  progressOver: '#E06C6F',
  macroProtein: '#8BA2E6',
  macroCarbs: '#E5B57D',
  macroFat: '#B597EE',
  headerHome: '#1E2D21',
  headerPantry: '#2F2222',
  headerRecipes: '#26222F',
  headerProfile: '#2E232E',
  shadow: '#000000',
};

export const colors = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  sheet: 32,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  number: { fontSize: 32, lineHeight: 38, fontWeight: '700', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colors[scheme], spacing, radii, typography };
}
