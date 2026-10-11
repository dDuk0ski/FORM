import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

type RowProps = {
  label: string;
  /** Right-hand value. Pass `children` instead for anything richer than text. */
  value?: string | number;
  children?: ReactNode;
};

export function Row({ label, value, children }: RowProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={[typography.body, { color: colors.textMuted, flexShrink: 1 }]}>{label}</Text>
      {children ??
        (value !== undefined && (
          <Text style={[typography.body, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
            {value}
          </Text>
        ))}
    </View>
  );
}
