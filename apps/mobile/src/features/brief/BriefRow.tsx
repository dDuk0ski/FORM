import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Children, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

type BriefRowProps = {
  icon: SFSymbol;
  label: string;
  /** The recommendation or takeaway. Always shown before the number. */
  headline: string;
  /** The number behind it, kept short. */
  detail?: string;
  tint?: keyof ColorTokens;
  onPress: () => void;
};

// One line of the brief: what to do first, the number second, details on tap.
export function BriefRow({
  icon,
  label,
  headline,
  detail,
  tint = 'primary',
  onPress,
}: BriefRowProps) {
  const { colors, spacing, radii, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${headline}${detail ? `. ${detail}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <SymbolView name={icon} tintColor={colors[tint]} size={20} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[typography.label, { color: colors.text }]}>{headline}</Text>
        {detail ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text>
        ) : null}
      </View>
      <SymbolView name="chevron.right" tintColor={colors.textMuted} size={14} />
    </Pressable>
  );
}

/** A card holding BriefRows, with hairlines between them. */
export function BriefList({ children }: { children: ReactNode }) {
  const { colors, radii } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.lg,
        overflow: 'hidden',
      }}
    >
      {rows.map((row, i) => (
        <View
          key={i}
          style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
        >
          {row}
        </View>
      ))}
    </View>
  );
}
