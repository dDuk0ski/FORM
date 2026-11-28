import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

// Onboarding flow: welcome, create account, verify email, then the profile setup.
export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}