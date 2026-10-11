import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
};

export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  unit,
  label,
}: NumberStepperProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  const stepButton = (sign: -1 | 1) => {
    const disabled = sign < 0 ? value <= min : value >= max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${sign < 0 ? 'Decrease' : 'Increase'}${label ? ` ${label}` : ''}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => set(value + sign * step)}
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
        <Text style={[typography.heading, { color: colors.text }]}>{sign < 0 ? '−' : '+'}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {stepButton(-1)}
        <Text
          accessibilityLiveRegion="polite"
          style={[typography.heading, { color: colors.text, minWidth: 72, textAlign: 'center' }]}
        >
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
        {stepButton(1)}
      </View>
    </View>
  );
}
