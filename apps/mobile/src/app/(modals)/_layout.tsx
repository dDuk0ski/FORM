import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

// Screens in this group are presented modally (see the root layout). Add new modals as
// files next to log-food.tsx.
export default function ModalLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
