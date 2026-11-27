import { Pressable, Text } from 'react-native';

import { defaultServing, formatNutrient, macrosForServing } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { Food } from '@/types/food';

import { AddCircle } from './AddCircle';
import { foodTabToken } from './foodTab';
import { TabbedRow } from './TabbedRow';

type FoodCardProps = {
  food: Food;
  onPress: (food: Food) => void;
};

/**
 * One search result, in the "Add food" frame's style: name, then "serving · kcal · protein"
 * for the default serving. Unknown values show "—". The whole row (including the "+") opens
 * the food.
 */
export function FoodCard({ food, onPress }: FoodCardProps) {
  const { colors, typography } = useTheme();
  const serving = defaultServing(food);
  const macros = macrosForServing(food, serving, 1);
  const kcal = formatNutrient(macros.kcal, 'kcal');
  const protein = formatNutrient(macros.protein_g, 'g');
  const kcalLabel = macros.kcal === null ? 'calories unknown' : kcal.accessibilityLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${kcalLabel} per ${serving.label}`}
      onPress={() => onPress(food)}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <TabbedRow tabColor={colors[foodTabToken(food.id)]} accessory={<AddCircle />}>
        <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
          {food.name}
        </Text>
        {food.brand ? (
          <Text style={[typography.caption, { color: colors.textMuted }]}>{food.brand}</Text>
        ) : null}
        <Text
          style={[typography.label, { color: colors.textMuted, fontVariant: ['tabular-nums'] }]}
        >
          {serving.label} · <Text>{kcal.text}</Text> · {protein.text} protein
        </Text>
      </TabbedRow>
    </Pressable>
  );
}
