import { Text, View } from 'react-native';

import { useTheme, withAlpha } from '@/theme';
import type { Progression } from '@/types/training';

import { ACTIONS, ACTION_INFO } from './progression';

// The progression model's probability for each of its four actions; the chosen one is solid.
export function ProbabilityBars({
  progression,
  color,
}: {
  progression: Progression;
  color: string;
}) {
  const { colors, spacing, radii, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {ACTIONS.map((action) => {
        const p = progression.probabilities[action];
        const chosen = action === progression.action;
        return (
          <View key={action} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.label, { color: chosen ? colors.text : colors.textMuted }]}>
                {ACTION_INFO[action].label}
              </Text>
              <Text style={[typography.label, { color: chosen ? colors.text : colors.textMuted }]}>
                {Math.round(p * 100)}%
              </Text>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: withAlpha(color, 0.12),
              }}
            >
              <View
                style={{
                  width: `${Math.round(p * 100)}%`,
                  height: 8,
                  borderRadius: radii.pill,
                  backgroundColor: chosen ? color : withAlpha(color, 0.35),
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
