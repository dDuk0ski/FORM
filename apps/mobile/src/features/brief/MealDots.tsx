import { Text, View } from 'react-native';

import { useTheme, withAlpha } from '@/theme';
import type { MealLog, MealSlot } from '@/types/nutrition';

const SLOTS: { meal: MealSlot; short: string }[] = [
  { meal: 'breakfast', short: 'B' },
  { meal: 'lunch', short: 'L' },
  { meal: 'dinner', short: 'D' },
  { meal: 'snack', short: 'S' },
];

// One dot per meal slot, filled once something is logged for it.
export function MealDots({ meals, color }: { meals: MealLog[]; color: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {SLOTS.map(({ meal, short }) => {
        const logged = meals.some((m) => m.meal === meal && m.items.length > 0);
        return (
          <View
            key={meal}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: logged ? color : withAlpha(color, 0.15),
            }}
          >
            <Text
              style={[
                typography.caption,
                { color: logged ? colors.onPrimary : color, fontWeight: '700' },
              ]}
            >
              {short}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
