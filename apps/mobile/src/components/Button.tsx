import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: primary ? colors.primary : colors.border,
        backgroundColor: primary ? colors.primary : colors.surface,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={[typography.label, { color: primary ? colors.onPrimary : colors.text }]}>
        {title}
      </Text>
    </Pressable>
  );
}
