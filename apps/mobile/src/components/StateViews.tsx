import { ActivityIndicator, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';

// Shared loading / empty / error states. Every data screen uses these so the three
// situations look and read the same everywhere.

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}
    >
      <ActivityIndicator color={colors.textMuted} />
      <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  message?: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl }}>
      <Text style={[typography.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

type ErrorStateProps = {
  title?: string;
  /** Say what went wrong and what the person can do about it. */
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}
    >
      <Text style={[typography.heading, { color: colors.danger, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
