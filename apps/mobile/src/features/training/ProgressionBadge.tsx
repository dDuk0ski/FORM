import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { useTheme, withAlpha } from '@/theme';
import type { Progression } from '@/types/training';

import { ACTION_INFO } from './progression';

// The progression model's decision as a small capsule: "↑ +2.5 kg", "= Hold", "↓ Lighter".
export function ProgressionBadge({ progression }: { progression: Progression }) {
  const { colors, spacing, radii, typography } = useTheme();
  const info = ACTION_INFO[progression.action];
  const color = colors[info.color];
  return (
    <View
      accessibilityLabel={`${info.label}: ${progression.change}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: 3,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: withAlpha(color, 0.15),
      }}
    >
      <SymbolView name={info.icon} tintColor={color} size={11} weight="bold" />
      <Text style={[typography.caption, { color, fontWeight: '700' }]}>{progression.change}</Text>
    </View>
  );
}
