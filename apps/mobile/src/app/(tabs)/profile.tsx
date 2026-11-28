import { Alert, Text } from 'react-native';

import { Button, Screen } from '@/components';
import { useSignOut } from '@/hooks/useSession';
import { useTheme } from '@/theme';

// Profile: account, body stats and goal, plus the weekly report.
// TODO(Profile): edit profiles row (sex, birth_date, height_cm,
// goal, activity_level, units, timezone). Starting targets come from the server.
// TODO(Profile): weekly insights — weight trend, strength trend, protein and
// calorie adherence, micronutrients averaging low.
// TODO(Profile): premium is a feature flag (profiles.is_premium) and a mock
// paywall screen, nothing more.
export default function ProfileScreen() {
  const { colors, typography } = useTheme();
  const signOut = useSignOut();

  // the root layout sends a signed out user back to welcome
  const handleSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut.mutate() },
    ]);
  };

  return (
    <Screen title="Profile">
      <Button title="Sign out" variant="secondary" onPress={handleSignOut} disabled={signOut.isPending} />
      {signOut.isError ? (
        <Text accessibilityRole="alert" style={[typography.label, { color: colors.danger, textAlign: 'center' }]}>
          {signOut.error.message}
        </Text>
      ) : null}
    </Screen>
  );
}
