import { Text } from 'react-native';

import { useTheme } from '@/theme';

import { Card } from './Card';

type DaySummaryCardProps = {
  /** The assistant's 2–3 sentences. Null or undefined hides the card. */
  summary: string | null | undefined;
};

// Small card for the on-device day summary. Renders nothing without a summary, so phones
// without Apple Intelligence never see an empty or "unavailable" card.
export function DaySummaryCard({ summary }: DaySummaryCardProps) {
  const { colors, typography } = useTheme();
  if (!summary) return null;
  return (
    <Card>
      <Text style={[typography.caption, { color: colors.textMuted }]}>Your day so far</Text>
      <Text style={[typography.body, { color: colors.text }]}>{summary}</Text>
    </Card>
  );
}
