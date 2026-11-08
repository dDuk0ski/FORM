import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, NumberStepper, Screen } from '@/components';
import { useTheme } from '@/theme';

const LAST_WEIGHT_KG = 82.4;

// TODO(Log): start from the latest body_metrics row and upsert today's (user_id, local date)
// on save. Weight is stored in kg; show lb for imperial profiles.
export default function WeighInSheet() {
  const { colors, typography } = useTheme();
  const [kg, setKg] = useState(LAST_WEIGHT_KG);
  return (
    <Screen title="Weigh in" edges={[]} scroll={false}>
      <Card>
        <NumberStepper
          label="Weight"
          value={kg}
          step={0.1}
          min={30}
          max={300}
          unit="kg"
          onChange={(next) => setKg(Math.round(next * 10) / 10)}
        />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Weigh in the morning, before eating. The trend matters, not one day.
        </Text>
      </Card>
      <Button title="Save" onPress={() => router.back()} />
    </Screen>
  );
}
