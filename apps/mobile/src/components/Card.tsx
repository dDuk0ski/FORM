import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "soft" is the Figma card: larger radius, thin light border and a soft shadow. */
  variant?: 'default' | 'soft';
};

export function Card({ children, style, variant = 'default' }: CardProps) {
  const { colors, spacing, radii } = useTheme();
  const soft = variant === 'soft';
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: soft ? colors.cardBorder : colors.border,
          borderWidth: 1,
          borderRadius: soft ? radii.xl : radii.lg,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        soft && {
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
