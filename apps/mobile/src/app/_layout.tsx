import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { useTheme } from '@/theme';

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
      </Stack>
    </QueryClientProvider>
  );
}
