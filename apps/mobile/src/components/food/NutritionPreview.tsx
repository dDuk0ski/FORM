import { Text } from 'react-native';

import { Card, Row } from '@/components';
import { formatNutrient, type NutrientUnit } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { FoodMacros, NutrientValue } from '@/types/food';

type NutritionPreviewProps = {
  /** Null while the amount is invalid; rows show a dash instead of a wrong number. */
  macros: FoodMacros | null;
};

function PreviewRow({
  label,
  value,
  unit,
  invalid,
}: {
  label: string;
  value: NutrientValue;
  unit: NutrientUnit;
  invalid: boolean;
}) {
  const { colors, typography } = useTheme();
  if (invalid) {
    return <Row label={label} value="–" />;
  }
  // An unknown value shows "—" (read as "unknown"), never 0.
  const display = formatNutrient(value, unit);
  return (
    <Row label={label}>
      <Text
        accessibilityLabel={display.accessibilityLabel}
        style={[typography.body, { color: colors.text, fontVariant: ['tabular-nums'] }]}
      >
        {display.text}
      </Text>
    </Row>
  );
}

/** What the entry will add to today, scaled to the chosen serving and amount. */
export function NutritionPreview({ macros }: NutritionPreviewProps) {
  const invalid = macros === null;
  return (
    <Card variant="soft">
      <PreviewRow label="Calories" value={macros?.kcal ?? null} unit="kcal" invalid={invalid} />
      <PreviewRow label="Protein" value={macros?.protein_g ?? null} unit="g" invalid={invalid} />
      <PreviewRow label="Carbs" value={macros?.carb_g ?? null} unit="g" invalid={invalid} />
      <PreviewRow label="Fat" value={macros?.fat_g ?? null} unit="g" invalid={invalid} />
    </Card>
  );
}
