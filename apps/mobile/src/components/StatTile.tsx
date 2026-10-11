import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

type StatTileProps = {
  label: string;
  value: string | number;
  unit?: string;
  caption?: string;
};

export function StatTile({ label, value, unit, caption }: StatTileProps) {
  const { colors, spacing, radii, typography } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        padding: spacing.lg,
        gap: spacing.xs,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
      }}
    >
      <Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.number, { color: colors.text }]}>
        {value}
        {unit ? <Text style={[typography.body, { color: colors.textMuted }]}> {unit}</Text> : null}
      </Text>
      {caption ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{caption}</Text>
      ) : null}
    </View>
  );
}
