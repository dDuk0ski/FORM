import { Text, View } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

type PillTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

type PillProps = {
  label: string;
  tone?: PillTone;
};

const toneColor: Record<PillTone, keyof ColorTokens> = {
  neutral: 'textMuted',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function Pill({ label, tone = 'neutral' }: PillProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const color = colors[toneColor[tone]];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs / 2,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <Text style={[typography.caption, { color }]}>{label}</Text>
    </View>
  );
}
