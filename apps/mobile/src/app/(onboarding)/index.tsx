import { Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button } from '@/components';
import { radii, spacing, typography, useTheme, withAlpha } from '@/theme';

// Welcome: first screen of onboarding.
// TODO(onboarding): replace the placeholder circle with the final design.
export default function WelcomeScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs }}>
            <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
                Welcome
            </Text>
            <Text style={[typography.lead, { color: colors.textMuted }]}>
                Login or sign up to FORM
            </Text>
            </View>

            {/* temp logo: a circle centered in the space above the tab */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View
                accessible={false}
                style={{
                width: 160,
                height: 160,
                borderRadius: radii.pill,
                backgroundColor: withAlpha(colors.primary, 0.15),
                }}
            />
            </View>
        </SafeAreaView>

        {/* bottom tab */}
        <View
            style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingTop: spacing.xl,
            paddingBottom: insets.bottom + spacing.lg,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 8,
            }}
        >
            <View style={{ width: '90%', alignSelf: 'center', gap: spacing.md }}>
            <Button title="Create Account" onPress={() => router.push('/signup')} />
            <Button title="Login" variant="secondary" onPress={() => {}} />
            </View>
        </View>
        </View>
    );
}