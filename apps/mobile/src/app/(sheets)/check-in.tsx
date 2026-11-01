import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, NumberStepper, Screen } from '@/components';

// TODO(Log): upsert today's readiness_checkins row on save, then refresh readiness.
export default function CheckInSheet() {
  const [sleep, setSleep] = useState(7);
  const [soreness, setSoreness] = useState(2);
  const [stress, setStress] = useState(2);
  return (
    <Screen title="Training check-in" edges={[]}>
      <Card>
        <NumberStepper
          label="Sleep last night"
          value={sleep}
          step={0.5}
          min={0}
          max={14}
          unit="h"
          onChange={setSleep}
        />
        <NumberStepper
          label="Soreness (1 to 5)"
          value={soreness}
          min={1}
          max={5}
          onChange={setSoreness}
        />
        <NumberStepper
          label="Stress (1 to 5)"
          value={stress}
          min={1}
          max={5}
          onChange={setStress}
        />
      </Card>
      <Button title="Save" onPress={() => router.back()} />
    </Screen>
  );
}
