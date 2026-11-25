import { TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

type SearchInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
  /** "soft" is the Figma pill-shaped search field; the default is unchanged. */
  variant?: 'default' | 'soft';
};

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search',
  accessibilityLabel = 'Search',
  autoFocus = false,
  variant = 'default',
}: SearchInputProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const soft = variant === 'soft';
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: soft ? colors.chipBorder : colors.border,
        borderRadius: soft ? radii.pill : radii.md,
        backgroundColor: colors.surface,
        paddingHorizontal: soft ? spacing.lg : spacing.md,
      }}
    >
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[typography.body, { color: colors.text, paddingVertical: spacing.md }]}
      />
    </View>
  );
}
