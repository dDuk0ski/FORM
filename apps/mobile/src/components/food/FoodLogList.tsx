import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components';
import { formatGrams, formatNutrient, formatQuantity } from '@/lib/nutrition';
import { useTheme } from '@/theme';
import type { FoodLogEntry } from '@/types/food';

import { MacroLine } from './MacroLine';

type FoodLogListProps = {
  entries: FoodLogEntry[];
  /** Omit to render the list read-only. */
  onRemove?: (entryId: string) => void;
  /** Entry currently being removed; its button is disabled. */
  removingId?: string | null;
};

/** Everything logged today, with the serving and quantity for each entry. */
export function FoodLogList({ entries, onRemove, removingId = null }: FoodLogListProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card variant="soft" style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
        Logged today
      </Text>
      {entries.length === 0 ? (
        <Text style={[typography.body, { color: colors.textMuted }]}>
          Nothing logged yet. Search for a food above to add your first entry.
        </Text>
      ) : (
        entries.map((entry) => (
          <View
            key={entry.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
          >
            <View style={{ flex: 1, gap: spacing.xs / 2 }}>
              <Text style={[typography.label, { color: colors.text }]}>{entry.food_name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {entry.serving_quantity !== null && entry.serving_label !== null
                  ? `${formatQuantity(entry.serving_quantity)} × ${entry.serving_label}`
                  : `${formatGrams(entry.grams)} g`}
              </Text>
              <MacroLine macros={entry.nutrients} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
              <Text
                accessibilityLabel={formatNutrient(entry.nutrients.kcal, 'kcal').accessibilityLabel}
                style={[typography.body, { color: colors.text, fontVariant: ['tabular-nums'] }]}
              >
                {formatNutrient(entry.nutrients.kcal, 'kcal').text}
              </Text>
              {onRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${entry.food_name}`}
                  accessibilityState={{ disabled: removingId === entry.id }}
                  disabled={removingId === entry.id}
                  hitSlop={8}
                  onPress={() => onRemove(entry.id)}
                >
                  <Text style={[typography.caption, { color: colors.danger }]}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </Card>
  );
}
