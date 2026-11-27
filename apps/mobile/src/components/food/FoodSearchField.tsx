import { SymbolView } from 'expo-symbols';
import { TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

type FoodSearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
};

/**
 * The "Add food" frame's search field: a grey filled pill with a search icon on the left.
 * The clear (x) button is the iOS one, shown while editing. It never takes focus on its own.
 */
export function FoodSearchField({ value, onChangeText }: FoodSearchFieldProps) {
  const { colors, spacing, radii, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceAlt,
        paddingLeft: spacing.lg,
        paddingRight: spacing.md,
      }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SymbolView name="magnifyingglass" tintColor={colors.textMuted} size={18} />
      </View>
      <TextInput
        accessibilityLabel="Search foods"
        value={value}
        onChangeText={onChangeText}
        placeholder="Search foods"
        placeholderTextColor={colors.textMuted}
        // Never focus on open: the keyboard would cover the meal rows. A tap focuses it.
        autoFocus={false}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[typography.body, { flex: 1, color: colors.text, paddingVertical: spacing.md }]}
      />
    </View>
  );
}
