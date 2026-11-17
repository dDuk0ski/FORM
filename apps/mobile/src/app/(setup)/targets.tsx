import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSetup } from '@/hooks/useSetup';
import { spacing, typography, useTheme } from '@/theme';

export default function SetupTargetsScreen() {
    const { colors } = useTheme();
    // TEMP: show everything saved so far
    const { data } = useSetup();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
                <Text style={[typography.title, { color: colors.text }]}>Your daily targets</Text>
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.label, { color: colors.textMuted }]}>Saved setup data</Text>
                    <Text style={[typography.body, { color: colors.text }]}>
                        {JSON.stringify(data ?? {}, null, 2)}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}