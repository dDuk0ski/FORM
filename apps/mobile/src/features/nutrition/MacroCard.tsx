import { Text, View } from 'react-native';

import { Card, ProgressBar } from '@/components';
import type { Macros, TodayResponse } from '@/types/api';
import { useTheme, type ColorTokens } from '@/theme';

import { formatNumber } from './format';

type MacroKey = Exclude<keyof Macros, 'kcal'>;

const MACROS: { key: MacroKey; label: string; color: keyof ColorTokens }[] = [
  { key: 'protein_g', label: 'Protein', color: 'protein' },
  { key: 'carb_g', label: 'Carbs', color: 'carb' },
  { key: 'fat_g', label: 'Fat', color: 'fat' },
];

type MacroCardProps = { today: TodayResponse };

export function MacroCard({ today }: MacroCardProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card>
      <Text style={[typography.heading, { color: colors.text }]}>Macros</Text>
      {MACROS.map(({ key, label, color }) => {
        const eaten = today.consumed[key];
        const target = today.targets[key];
        const left = today.remaining[key];
        return (
          <View key={key} style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
              <Text style={[typography.label, { color: colors.textMuted }]}>
                {formatNumber(eaten)} / {formatNumber(target)} g
              </Text>
            </View>
            <ProgressBar
              value={eaten}
              max={target}
              color={color}
              accessibilityLabel={`${label} eaten against target`}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {left >= 0 ? `${formatNumber(left)} g left` : `${formatNumber(-left)} g over`}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}
