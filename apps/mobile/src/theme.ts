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
