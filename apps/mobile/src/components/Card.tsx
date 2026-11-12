import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, style }: CardProps) {
  const { scheme, colors, spacing, radii } = useTheme();
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
        style,
      ]}
    >
      {children}
    </View>
  );
}
