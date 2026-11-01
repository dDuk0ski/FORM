import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { useTheme } from '@/theme';

function sheet(detents: number[] | 'fitToContents') {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 20,
  } as const;
}

export default function RootLayout() {
  const { colors } = useTheme();
  const [queryClient] = useState(() => new QueryClient());

  // TODO(auth): gate on the Supabase session from @/api/supabase and send
  // signed-out users to the sign-in flow. Not part of the boilerplate.
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
        {/* Sheets over Today: brief details, quick log and the weekly report. */}
        <Stack.Screen name="(sheets)/brief/[section]" options={sheet([0.6, 1])} />
        <Stack.Screen name="(sheets)/quick-log" options={sheet('fitToContents')} />
        <Stack.Screen name="(sheets)/weigh-in" options={sheet('fitToContents')} />
        <Stack.Screen name="(sheets)/check-in" options={sheet('fitToContents')} />
        <Stack.Screen name="(sheets)/weekly" options={sheet([1])} />
      </Stack>
    </QueryClientProvider>
  );
}
