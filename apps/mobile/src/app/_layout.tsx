import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/theme';

function sheet(detents: number[] | 'fitToContents') {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 20,
  } as const;
}

function RootNavigator() {
  const { colors } = useTheme();
  const { data: session, isPending } = useSession();

  // wait for the getSession() call so a signed in user doesn't see the onboarding flash on screen
  if (isPending) return null;

  const isSignedIn = session != null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(sheets)/brief/[section]" options={sheet([0.6, 1])} />
        <Stack.Screen name="(sheets)/weigh-in" options={sheet('fitToContents')} />
        <Stack.Screen name="(sheets)/check-in" options={sheet('fitToContents')} />
        <Stack.Screen name="(sheets)/weekly" options={sheet([1])} />
        <Stack.Screen name="(sheets)/exercise/[id]" options={sheet([0.75, 1])} />
        <Stack.Screen name="(sheets)/training-preferences" options={sheet([1])} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <RootNavigator />
    </QueryClientProvider>
  );
}