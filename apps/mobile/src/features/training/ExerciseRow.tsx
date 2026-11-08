import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { useTheme, withAlpha } from '@/theme';
import type { SessionExercise } from '@/types/training';

import { ProgressionBadge } from './ProgressionBadge';

type ExerciseRowProps = {
  index: number;
  exercise: SessionExercise;
  color: string;
  onPress: () => void;
};

// One exercise in today's plan: what to lift, then the model's change since last time.
export function ExerciseRow({ index, exercise: ex, color, onPress }: ExerciseRowProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ex.name}, ${ex.sets} sets of ${ex.reps_min} to ${ex.reps_max} at ${ex.weight_kg} kilograms`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ex.role === 'accessory' ? withAlpha(color, 0.12) : color,
        }}
      >
        <Text
          style={[
            typography.label,
            { color: ex.role === 'accessory' ? color : colors.onPrimary, fontWeight: '700' },
          ]}
        >
          {index}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.label, { color: colors.text, fontSize: 16 }]}>{ex.name}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {ex.sets} × {ex.reps_min}–{ex.reps_max} · {ex.weight_kg} kg · {ex.rir} RIR
        </Text>
      </View>
      <ProgressionBadge progression={ex.progression} />
      <SymbolView name="chevron.right" tintColor={colors.textMuted} size={12} weight="semibold" />
    </Pressable>
  );
}
