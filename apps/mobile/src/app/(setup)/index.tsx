import { Pressable, Text, View } from 'react-native';

import { useCompleteOnboarding } from '@/hooks/useOnboarding';
import { useTheme } from '@/theme';

export default function SetupPlaceholder() {
    const { colors } = useTheme();
    const complete = useCompleteOnboarding();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text }}>Setup (placeholder)</Text>
      {/* TEMP: lets us test the gate end to end, remove when the real last setup screen exists */}
      <Pressable onPress={() => complete.mutate()}>
        <Text style={{ color: colors.primary }}>Finish setup</Text>
      </Pressable>
    </View>
  );
}