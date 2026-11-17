import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { typography } from '@/theme';

// TODO(setup): build the body-stats screen
export default function SetupBodyStatsScreen() {
    const { colors } = useTheme();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[typography.title, { color: colors.text }]}>Your body and goal</Text>
            </View>
        </SafeAreaView>
    );
}