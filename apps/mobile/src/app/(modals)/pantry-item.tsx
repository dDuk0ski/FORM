import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, Screen } from '@/components';
import {
  useAddPantryItem,
  usePantry,
  useRemovePantryItem,
  useUpdatePantryItem,
} from '@/hooks/usePantry';
import { useTheme } from '@/theme';
import type { PantryItem } from '@/types/pantry';
import type { IsoDate } from '@/types/api';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onFocus?: () => void;
};

function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  onFocus,
}: FieldProps) {
  const { colors, spacing, radii, typography } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        onFocus={onFocus}
        style={{
          color: colors.text,
          fontSize: typography.body.fontSize,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radii.md,
        }}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </View>
  );
}

type FormValues = {
  name: string;
  quantity: string;
  unit: string;
  expirationDate: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.name.trim() === '') errors.name = 'Name is required.';

  const quantityText = values.quantity.trim().replace(',', '.');
  const quantity = Number(quantityText);
  if (quantityText === '' || !Number.isFinite(quantity) || quantity <= 0)
    errors.quantity = 'Enter a quantity greater than 0.';

  if (values.unit.trim() === '') errors.unit = 'Unit is required.';

  return errors;
}

function toDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  const [year, month, day] = match.slice(1).map(Number);
  return new Date(year, month - 1, day);
}

function toIsoString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Form for adding or editing a pantry item
function PantryItemForm({ item }: { item?: PantryItem }) {
  const { colors, spacing, radii, typography } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [expirationDate, setExpirationDate] = useState<string>(item?.expiration_date ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const router = useRouter();
  const addItem = useAddPantryItem();
  const removeItem = useRemovePantryItem();
  const updateItem = useUpdatePantryItem();
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSaving = addItem.isPending || updateItem.isPending;
  const isBusy = isSaving || removeItem.isPending;

  const allErrors = validate({ name, quantity, unit, expirationDate });
  const errors = showErrors ? allErrors : {};

  // Handle deleting the pantry item
  const handleDelete = () => {
    if (!item) return;
    Alert.alert(`Delete ${item.name}?`, 'This removes it from your pantry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeItem.mutateAsync(item.id);
            router.back();
          } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to delete. Try again.');
          }
        },
      },
    ]);
  };

  // Handle saving the pantry item
  const handleSave = async () => {
    setShowErrors(true);
    if (Object.keys(allErrors).length > 0) return;

    setSaveError(null);
    const date = expirationDate.trim();
    const values = {
      name: name.trim(),
      quantity: Number(quantity.trim().replace(',', '.')),
      unit: unit.trim(),
      expiration_date: date === '' ? null : (date as IsoDate),
    };

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, patch: values });
      } else {
        await addItem.mutateAsync({ ...values, category: null });
      }
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save. Try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen title={item ? 'Edit item' : 'Add item'} edges={['top']}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="ex. Chicken breast"
          onFocus={() => setShowPicker(false)}
        />
        <Field
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          error={errors.quantity}
          placeholder="ex. 500"
          keyboardType="decimal-pad"
          onFocus={() => setShowPicker(false)}
        />
        <Field
          label="Unit"
          value={unit}
          onChangeText={setUnit}
          error={errors.unit}
          placeholder="ex. grams"
          autoCapitalize="none"
          onFocus={() => setShowPicker(false)}
        />
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.eyebrow, { color: colors.textMuted }]}>
            EXPIRATION DATE (OPTIONAL)
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setShowPicker((open) => !open);
              }}
              accessibilityRole="button"
              accessibilityLabel="Expiration date"
              accessibilityValue={{ text: expirationDate || 'No date' }}
              style={{
                flex: 1,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.md,
              }}
            >
              <Text
                style={{
                  color: expirationDate ? colors.text : colors.textMuted,
                  fontSize: typography.body.fontSize,
                }}
              >
                {expirationDate || 'No date'}
              </Text>
            </Pressable>

            {expirationDate ? (
              <Pressable
                onPress={() => {
                  setExpirationDate('');
                  setShowPicker(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear expiration date"
                style={{
                  justifyContent: 'center',
                  paddingHorizontal: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                }}
              >
                <Text style={[typography.label, { color: colors.text }]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {showPicker ? (
            <DateTimePicker
              value={toDate(expirationDate)}
              mode="date"
              display="inline"
              onValueChange={(_event, selected) => setExpirationDate(toIsoString(selected))}
            />
          ) : null}
        </View>

        {saveError ? <Text style={{ color: colors.danger }}>{saveError}</Text> : null}
        <Button title={isSaving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={isBusy} />
        {item ? (
          <Button title="Delete" variant="secondary" onPress={handleDelete} disabled={isBusy} />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

// Renders the pantry item screen
export default function PantryItemScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { data, isLoading } = usePantry();

  // Add item
  if (id === undefined) return <PantryItemForm />;

  // Edit item
  if (isLoading) {
    return (
      <Screen title="Edit item">
        <ActivityIndicator />
      </Screen>
    );
  }

  const item = data?.find((entry) => entry.id === id);
  if (!item) {
    return (
      <Screen title="Edit item">
        <Text style={{ color: colors.textMuted }}>This item could not be found.</Text>
      </Screen>
    );
  }

  return <PantryItemForm key={item.id} item={item} />;
}
