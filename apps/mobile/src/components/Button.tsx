import { Pressable, Text } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'softOutline';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** "soft" and "softOutline" are the Figma pill styles; the defaults are unchanged. */
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
};

type VariantColors = {
  fill: keyof ColorTokens;
  border: keyof ColorTokens;
  text: keyof ColorTokens;
};

const variantColors: Record<ButtonVariant, VariantColors> = {
  primary: { fill: 'primary', border: 'primary', text: 'onPrimary' },
  secondary: { fill: 'surface', border: 'border', text: 'text' },
  soft: { fill: 'primarySoft', border: 'primarySoftBorder', text: 'onPrimarySoft' },
  softOutline: { fill: 'surface', border: 'chipBorder', text: 'text' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const palette = variantColors[variant];
  const pill = variant === 'soft' || variant === 'softOutline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        paddingVertical: pill ? spacing.lg : spacing.md,
        paddingHorizontal: pill ? spacing.xl : spacing.lg,
        borderRadius: pill ? radii.pill : radii.md,
        borderWidth: 1,
        borderColor: colors[palette.border],
        backgroundColor: colors[palette.fill],
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={[typography.label, { color: colors[palette.text] }]}>{title}</Text>
    </Pressable>
  );
}
