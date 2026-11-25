import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components';
import { defaultServing, formatNutrient, macrosForServing } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { Food } from '@/types/food';

import { MacroLine } from './MacroLine';

type FoodCardProps = {
  food: Food;
  onPress: (food: Food) => void;
};

/** One search result: name, default serving, calories and macros for that serving. */
export function FoodCard({ food, onPress }: FoodCardProps) {
  const { colors, spacing, typography } = useTheme();
  const serving = defaultServing(food);
  const macros = macrosForServing(food, serving, 1);
  const kcal = formatNutrient(macros.kcal, 'kcal');
  const kcalLabel = macros.kcal === null ? 'calories unknown' : kcal.accessibilityLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${kcalLabel} per ${serving.label}`}
      onPress={() => onPress(food)}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card variant="soft">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs / 2 }}>
            <Text style={[typography.label, { color: colors.text }]}>{food.name}</Text>
            {food.brand ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>{food.brand}</Text>
            ) : null}
            <Text style={[typography.caption, { color: colors.textMuted }]}>{serving.label}</Text>
          </View>
          <Text
            accessibilityLabel={kcal.accessibilityLabel}
            style={[typography.heading, { color: colors.text, fontVariant: ['tabular-nums'] }]}
          >
            {kcal.text}
          </Text>
        </View>
        <MacroLine macros={macros} />
      </Card>
    </Pressable>
  );
}
