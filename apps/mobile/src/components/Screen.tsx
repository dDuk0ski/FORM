import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type ScreenProps = {
  title: string;
  children?: ReactNode;
  /** Wrap content in a ScrollView. Turn off for screens that render their own FlatList. */
  scroll?: boolean;
  /** Safe-area edges to pad. Tabs have no header, so the default pads the top. */
  edges?: Edge[];
};

export function Screen({ title, children, scroll = true, edges = ['top'] }: ScreenProps) {
  const { colors, spacing, typography } = useTheme();
  const content = (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled">{content}</ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
