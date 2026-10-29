import { Text, View } from 'react-native';

import { formatGrams } from '@/lib/nutrition';
import { useTheme, type ColorTokens } from '@/theme';
import type { Macros } from '@/types/api';

/** "Protein 12 g   Carbs 30 g   Fat 5 g" in one row, each with its Figma macro-color dot. */
export function MacroLine({ macros }: { macros: Macros }) {
  const { colors, spacing, radii, typography } = useTheme();
  const items: [string, number, keyof ColorTokens][] = [
    ['Protein', macros.protein_g, 'macroProtein'],
    ['Carbs', macros.carb_g, 'macroCarbs'],
    ['Fat', macros.fat_g, 'macroFat'],
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md }}>
      {items.map(([label, grams, dot]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <View
            style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors[dot] }}
          />
          <Text
            style={[typography.caption, { color: colors.textMuted, fontVariant: ['tabular-nums'] }]}
          >
            {label} {formatGrams(grams)} g
          </Text>
        </View>
      ))}
    </View>
  );
}
