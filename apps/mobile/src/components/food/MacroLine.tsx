import { Text, View } from 'react-native';

import { formatGrams } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { Macros } from '@/types/api';

/** "Protein 12 g   Carbs 30 g   Fat 5 g" in one row. */
export function MacroLine({ macros }: { macros: Macros }) {
  const { colors, spacing, typography } = useTheme();
  const items: [string, number][] = [
    ['Protein', macros.protein_g],
    ['Carbs', macros.carb_g],
    ['Fat', macros.fat_g],
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md }}>
      {items.map(([label, grams]) => (
        <Text
          key={label}
          style={[typography.caption, { color: colors.textMuted, fontVariant: ['tabular-nums'] }]}
        >
          {label} {formatGrams(grams)} g
        </Text>
      ))}
    </View>
  );
}
