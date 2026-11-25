import { Text, View } from 'react-native';

import { formatNutrient } from '@/lib/nutrition';
import { useTheme, type ColorTokens } from '@/theme';
import type { FoodMacros, NutrientValue } from '@/types/food';

/**
 * "Protein 12 g   Carbs 30 g   Fat 5 g" in one row, each with its Figma macro-color dot.
 * An unknown value shows "—" (read as "unknown"), never 0.
 */
export function MacroLine({ macros }: { macros: FoodMacros }) {
  const { colors, spacing, radii, typography } = useTheme();
  const items: [string, NutrientValue, keyof ColorTokens][] = [
    ['Protein', macros.protein_g, 'macroProtein'],
    ['Carbs', macros.carb_g, 'macroCarbs'],
    ['Fat', macros.fat_g, 'macroFat'],
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md }}>
      {items.map(([label, grams, dot]) => {
        const display = formatNutrient(grams, 'g');
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: colors[dot],
              }}
            />
            <Text
              accessibilityLabel={`${label} ${display.accessibilityLabel}`}
              style={[
                typography.caption,
                { color: colors.textMuted, fontVariant: ['tabular-nums'] },
              ]}
            >
              {label} {display.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
