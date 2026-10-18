import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

type QuantityFieldProps = {
  label: string;
  /** Raw text, so the person can type "1." or clear the box. Validate with parseQuantity. */
  value: string;
  onChangeText: (text: string) => void;
  onStep: (direction: -1 | 1) => void;
  /** Validation message; the field turns red and the message is announced. */
  error: string | null;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
};

/** A number box with minus / plus buttons, for how many servings were eaten. */
export function QuantityField({
  label,
  value,
  onChangeText,
  onStep,
  error,
  decrementDisabled = false,
  incrementDisabled = false,
}: QuantityFieldProps) {
  const { colors, spacing, radii, typography } = useTheme();

  const stepButton = (direction: -1 | 1, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${direction < 0 ? 'Decrease' : 'Increase'} ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onStep(direction)}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={[typography.heading, { color: colors.text }]}>{direction < 0 ? '−' : '+'}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {stepButton(-1, decrementDisabled)}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={[
            typography.heading,
            {
              flex: 1,
              minHeight: 44,
              textAlign: 'center',
              color: colors.text,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: error ? colors.danger : colors.border,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
            },
          ]}
        />
        {stepButton(1, incrementDisabled)}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
