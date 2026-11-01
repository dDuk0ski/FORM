import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type QuickAction = { icon: SFSymbol; label: string; color: string; onPress: () => void };

// A row of round buttons, like Control Center: tap one to log that thing directly.
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={a.onPress}
          style={({ pressed }) => ({
            alignItems: 'center',
            gap: spacing.xs,
            width: 76,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: a.color,
            }}
          >
            <SymbolView name={a.icon} tintColor={colors.onPrimary} size={24} weight="semibold" />
          </View>
          <Text style={[typography.caption, { color: colors.text, textAlign: 'center' }]}>
            {a.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
