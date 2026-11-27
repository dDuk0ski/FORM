import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDayHeading } from '@/lib/dates';
import { useTheme } from '@/theme';

import { ROUND_BUTTON_SIZE, RoundBackButton } from './RoundBackButton';

type FoodSheetScreenProps = {
  title: string;
  /** Background of the top area, per frame: green for Log food, blue for Add food. */
  tint: 'headerLogFood' | 'headerAddFood';
  /** The screen's existing close / back action. */
  onBack: () => void;
  backLabel?: string;
  /** Line under the title. Defaults to the device's local date, e.g. "Saturday, Oct 31". */
  subtitle?: ReactNode;
  /** Extra content on the tinted area, between the header and the sheet. */
  top?: ReactNode;
  /** Content of the white sheet. */
  children?: ReactNode;
};

/**
 * Layout shared by the food screens, after the "Log food" and "Add food" frames: a soft
 * tinted top with a centered title, a round back button and the date, and the content on a
 * large rounded white sheet. Still presented as an iOS modal; only the inside changed.
 */
export function FoodSheetScreen({
  title,
  tint,
  onBack,
  backLabel,
  subtitle,
  top,
  children,
}: FoodSheetScreenProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const sub = subtitle === undefined ? formatDayHeading() : subtitle;

  return (
    <View style={{ flex: 1, backgroundColor: colors[tint] }}>
      {/* White under the sheet, so pulling past the end never shows the tint. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '50%',
          backgroundColor: colors.surface,
        }}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{
            paddingTop: spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RoundBackButton onPress={onBack} accessibilityLabel={backLabel} />
            <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs / 2 }}>
              <Text
                accessibilityRole="header"
                style={[typography.heading, { color: colors.text, textAlign: 'center' }]}
              >
                {title}
              </Text>
              {typeof sub === 'string' ? (
                <Text style={[typography.label, { color: colors.textMuted, textAlign: 'center' }]}>
                  {sub}
                </Text>
              ) : (
                sub
              )}
            </View>
            {/* Balances the back button so the title stays centered. */}
            <View style={{ width: ROUND_BUTTON_SIZE }} />
          </View>
          {top}
        </View>
        <View
          style={{
            flexGrow: 1,
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg,
            gap: spacing.lg,
          }}
        >
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
