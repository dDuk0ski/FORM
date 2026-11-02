import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme, withAlpha } from '@/theme';

type TileProps = {
  icon: SFSymbol;
  label: string;
  /** Accent for the icon and label; one per area of the brief. */
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  /** Grow to share a row with another tile. */
  flex?: boolean;
};

// A tappable card: colored icon and label on top, the recommendation and number below.
export function Tile({
  icon,
  label,
  color,
  onPress,
  accessibilityLabel,
  children,
  flex,
}: TileProps) {
  const { scheme, colors, spacing, radii, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radii.xl,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...(scheme === 'light' && {
          shadowColor: colors.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }),
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(color, 0.15),
          }}
        >
          <SymbolView name={icon} tintColor={color} size={15} weight="semibold" />
        </View>
        <Text style={[typography.eyebrow, { color, flex: 1 }]}>{label.toUpperCase()}</Text>
        <SymbolView name="chevron.right" tintColor={colors.textMuted} size={12} weight="semibold" />
      </View>
      {children}
    </Pressable>
  );
}
