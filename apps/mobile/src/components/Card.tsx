import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "soft" is the Figma food card: the default card plus a thin light border and a shadow in both schemes. */
  variant?: 'default' | 'soft';
};

export function Card({ children, style, variant = 'default' }: CardProps) {
  const { scheme, colors, spacing, radii } = useTheme();
  const soft = variant === 'soft';
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.xl,
          borderCurve: 'continuous',
          padding: spacing.lg,
          gap: spacing.sm,
          ...(scheme === 'light' && {
            shadowColor: colors.shadow,
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }),
        },
        soft && {
          borderRadius: radii.xlSoft,
          borderColor: colors.cardBorder,
          borderWidth: 1,
          shadowColor: colors.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
