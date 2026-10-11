import { Screen } from '@/components';

// Profile: account, body stats and goal, plus the weekly report.
// TODO(Profile): sign out; edit profiles row (sex, birth_date, height_cm,
// goal, activity_level, units, timezone). Starting targets come from the server.
// TODO(Profile): weekly insights — weight trend, strength trend, protein and
// calorie adherence, micronutrients averaging low.
// TODO(Profile): premium is a feature flag (profiles.is_premium) and a mock
// paywall screen, nothing more.
export default function ProfileScreen() {
  return <Screen title="Profile" />;
}
