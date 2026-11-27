import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components';
import { BarcodeScanner, scannerColors } from '@/components/scanner';
import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { errorMessage } from '@/lib/errors';
import { parseMeal } from '@/lib/nutrition';
import { useTheme } from '@/theme';

// Scan (or type) a food barcode. Open with router.push('/scan-barcode') from Log food.
// Flow: a valid code → "Looking up…" → found: replace this modal with /food-detail for that
// food, marked source 'barcode' (so "Back to search" there returns to Log food) /
// not found: "Scan again" or "Search by name" / error: message with Retry (and the same
// two ways out).
// Lookups go through barcodeService (src/api/barcode.ts): fake sample codes in mock mode;
// in real mode the server lookup is not connected yet, which shows as an error here.
export default function ScanBarcodeModal() {
  // `meal` comes from the meal-first Log food's search; it is passed on to food detail.
  const meal = parseMeal(useLocalSearchParams<{ meal?: string }>()?.meal);
  const lookup = useBarcodeLookup();
  const [lastCode, setLastCode] = useState<string | null>(null);
  const { spacing, typography } = useTheme();

  const lookUp = (code: string) => {
    setLastCode(code);
    lookup.mutate(code, {
      onSuccess: (food) => {
        if (food) {
          router.replace({
            pathname: '/food-detail',
            params: meal
              ? { id: food.id, source: 'barcode', meal }
              : { id: food.id, source: 'barcode' },
          });
        }
      },
    });
  };

  const searchByName = () => router.back();

  const textStyle = [
    typography.body,
    { color: scannerColors.onCamera, textAlign: 'center' as const },
  ];
  const headingStyle = [
    typography.heading,
    { color: scannerColors.onCamera, textAlign: 'center' as const },
  ];

  let status: ReactNode = null;
  if (lookup.isPending) {
    status = (
      <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.sm }}>
        <ActivityIndicator color={scannerColors.onCamera} />
        <Text style={textStyle}>Looking up {lastCode}…</Text>
      </View>
    );
  } else if (lookup.isError) {
    status = (
      <View accessibilityRole="alert" style={{ gap: spacing.sm }}>
        <Text style={headingStyle}>Couldn’t look up this barcode</Text>
        <Text style={textStyle}>{errorMessage(lookup.error)}</Text>
        <Button
          title="Retry"
          accessibilityLabel="Retry barcode lookup"
          variant="soft"
          onPress={() => lastCode && lookUp(lastCode)}
        />
        <Button title="Scan again" variant="softOutline" onPress={() => lookup.reset()} />
        <Button title="Search by name" variant="softOutline" onPress={searchByName} />
      </View>
    );
  } else if (lookup.isSuccess && lookup.data === null) {
    status = (
      <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm }}>
        <Text style={headingStyle}>We couldn’t find that product</Text>
        <Text style={textStyle}>No match for {lastCode}.</Text>
        <Button title="Scan again" variant="soft" onPress={() => lookup.reset()} />
        <Button title="Search by name" variant="softOutline" onPress={searchByName} />
      </View>
    );
  } else if (lookup.isSuccess && lookup.data) {
    status = (
      <Text accessibilityLiveRegion="polite" style={textStyle}>
        Found {lookup.data.name}. Opening…
      </Text>
    );
  }

  return (
    <BarcodeScanner
      onScanned={lookUp}
      onBack={() => router.back()}
      // One code at a time: scanning resumes only after "Scan again", never while a lookup
      // or a result is on screen.
      active={lookup.isIdle}
    >
      {status}
    </BarcodeScanner>
  );
}
