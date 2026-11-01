import { router, type Href } from 'expo-router';

import { Screen } from '@/components';
import { BriefList, BriefRow } from '@/features/brief';

const OPTIONS: {
  icon: Parameters<typeof BriefRow>[0]['icon'];
  label: string;
  headline: string;
  href: Href;
}[] = [
  { icon: 'fork.knife', label: 'Food', headline: 'Log a meal', href: '/log-food' },
  { icon: 'scalemass', label: 'Body', headline: 'Weigh in', href: '/weigh-in' },
  { icon: 'heart', label: 'Readiness', headline: 'Check in for training', href: '/check-in' },
  { icon: 'dumbbell', label: 'Training', headline: 'Log a workout', href: '/workout-logger' },
];

// Quick log: pick what to log, then go straight to that screen.
export default function QuickLogSheet() {
  return (
    <Screen title="Log" edges={[]} scroll={false}>
      <BriefList>
        {OPTIONS.map((o) => (
          <BriefRow
            key={o.label}
            icon={o.icon}
            label={o.label}
            headline={o.headline}
            onPress={() => router.replace(o.href)}
          />
        ))}
      </BriefList>
    </Screen>
  );
}
