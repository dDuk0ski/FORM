import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { parseBarcode } from '@/lib/barcode';
import { useTheme } from '@/theme';

import { scannerColors } from './scannerColors';

type BarcodeEntryProps = {
  /** Called with a valid, normalized code. */
  onSubmit: (code: string) => void;
  disabled?: boolean;
};

/**
 * Type a barcode instead of scanning it. Validates on "Look up" and shows the problem inline;
 * never throws on empty, letters or the wrong length. Also the test path on the iOS
 * Simulator, which has no camera.
 */
export function BarcodeEntry({ onSubmit, disabled = false }: BarcodeEntryProps) {
  const { spacing, radii, typography } = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (disabled) {
      return;
    }
    const parsed = parseBarcode(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onSubmit(parsed.code);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.label, { color: scannerColors.onCamera }]}>Or type the barcode</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: error ? scannerColors.fieldError : scannerColors.fieldBorder,
            borderRadius: radii.pill,
            backgroundColor: scannerColors.field,
            paddingHorizontal: spacing.lg,
          }}
        >
          <TextInput
            accessibilityLabel="Barcode number"
            accessibilityHint="8, 12 or 13 digits from under the barcode"
            value={text}
            onChangeText={(next) => {
              setText(next);
              setError(null);
            }}
            onSubmitEditing={submit}
            placeholder="8, 12 or 13 digits"
            placeholderTextColor={scannerColors.fieldPlaceholder}
            keyboardType="number-pad"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={24}
            editable={!disabled}
            style={[
              typography.body,
              { color: scannerColors.fieldText, paddingVertical: spacing.md },
            ]}
          />
        </View>
        <Button
          title="Look up"
          accessibilityLabel="Look up barcode"
          variant="soft"
          onPress={submit}
          disabled={disabled}
        />
      </View>
      {error ? (
        // White, not red: red text on the gray panel is below WCAG AA contrast. The field's
        // red border still marks the error.
        <Text
          accessibilityRole="alert"
          style={[typography.label, { color: scannerColors.onCamera }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
