import { Card, Row } from '@/components';
import { formatGrams, formatKcal } from '@/lib/nutrition';
import type { Macros } from '@/types/api';

type NutritionPreviewProps = {
  /** Null while the amount is invalid; rows show a dash instead of a wrong number. */
  macros: Macros | null;
};

/** What the entry will add to today, scaled to the chosen serving and amount. */
export function NutritionPreview({ macros }: NutritionPreviewProps) {
  return (
    <Card>
      <Row label="Calories" value={macros ? `${formatKcal(macros.kcal)} kcal` : '–'} />
      <Row label="Protein" value={macros ? `${formatGrams(macros.protein_g)} g` : '–'} />
      <Row label="Carbs" value={macros ? `${formatGrams(macros.carb_g)} g` : '–'} />
      <Row label="Fat" value={macros ? `${formatGrams(macros.fat_g)} g` : '–'} />
    </Card>
  );
}
