import { Text, View } from 'react-native';

import { FOOD_DATA_SOURCE } from '@/api/foods';
import { Pill } from '@/components';
import { useTheme } from '@/theme';

/** Tells the person the food data is not production data. Renders nothing once it is. */
export function DataSourceNotice() {
  const { colors, spacing, typography } = useTheme();
  if (FOOD_DATA_SOURCE !== 'mock') {
    return null;
  }
  return (
    <View style={{ gap: spacing.xs }}>
      <Pill label="Sample data" tone="warning" />
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Foods are samples, and your log is saved on this device only, not to your account.
      </Text>
    </View>
  );
}
