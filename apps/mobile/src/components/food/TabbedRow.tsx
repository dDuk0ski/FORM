import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { softShadow } from './softShadow';

export const ROW_TAB_WIDTH = 56;

type TabbedRowProps = {
  /** Color of the left tab (a theme color). */
  tabColor: string;
  /** Optional content centered on the tab, e.g. a meal icon. */
  tab?: ReactNode;
  /** Main content of the white panel. */
  children: ReactNode;
  /** Right-hand content, e.g. the round "+" or a Remove link. */
  accessory?: ReactNode;
};

/** The frames' row: a rounded white card over a colored left tab, with a soft shadow. */
export function TabbedRow({ tabColor, tab, children, accessory }: TabbedRowProps) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View style={[{ borderRadius: radii.xlSoft, backgroundColor: tabColor }, softShadow(colors)]}>
      <View style={{ flexDirection: 'row', borderRadius: radii.xlSoft, overflow: 'hidden' }}>
        <View
          style={{ width: ROW_TAB_WIDTH, alignItems: 'center', justifyContent: 'center' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {tab}
        </View>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: 64,
            paddingVertical: spacing.md,
            paddingLeft: spacing.lg,
            paddingRight: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radii.xlSoft,
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs / 2 }}>{children}</View>
          {accessory}
        </View>
      </View>
    </View>
  );
}
