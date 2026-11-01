import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, Text } from 'react-native';

import { useTheme, withAlpha } from '@/theme';

type AlertChipProps = { icon: SFSymbol; label: string; color: string; onPress: () => void };

// A tinted capsule for things that need attention today (expiring food, a low nutrient).
export function AlertChip({ icon, label, color, onPress }: AlertChipProps) {
  const { spacing, radii, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        backgroundColor: withAlpha(color, pressed ? 0.28 : 0.16),
      })}
    >
      <SymbolView name={icon} tintColor={color} size={14} weight="semibold" />
      <Text style={[typography.label, { color }]}>{label}</Text>
    </Pressable>
  );
}
