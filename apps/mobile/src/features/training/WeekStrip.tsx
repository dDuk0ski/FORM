import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { useTheme, withAlpha } from '@/theme';
import type { PlanDay } from '@/types/training';

// The week at a glance: done sessions filled, today ringed, rest days dimmed.
export function WeekStrip({ days, color }: { days: PlanDay[]; color: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((day, i) => (
        <View
          key={i}
          accessibilityLabel={`${day.weekday}: ${day.name ?? 'rest'}, ${day.status}`}
          style={{ alignItems: 'center', gap: spacing.xs, width: 44 }}
        >
          <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '600' }]}>
            {day.weekday}
          </Text>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                day.status === 'done'
                  ? color
                  : day.status === 'rest'
                    ? 'transparent'
                    : withAlpha(color, 0.12),
              borderWidth: day.status === 'today' ? 2.5 : 0,
              borderColor: color,
            }}
          >
            {day.status === 'done' ? (
              <SymbolView name="checkmark" tintColor={colors.onPrimary} size={15} weight="bold" />
            ) : day.status === 'rest' ? (
              <SymbolView name="moon.zzz.fill" tintColor={colors.textMuted} size={14} />
            ) : (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            )}
          </View>
          <Text
            numberOfLines={1}
            style={[
              typography.caption,
              { fontSize: 10, color: day.status === 'today' ? color : colors.textMuted },
            ]}
          >
            {day.name ?? 'Rest'}
          </Text>
        </View>
      ))}
    </View>
  );
}
