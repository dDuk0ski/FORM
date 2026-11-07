import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, Screen } from '@/components';
import { useAddPantryItem, usePantry, useRemovePantryItem, useUpdatePantryItem } from '@/hooks/usePantry';
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
};

function Field({
    label,
    value,
    onChangeText,
    error,
    placeholder,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
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

function isRealDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const [year, month, day] = match.slice(1).map(Number);
    // Build the date and check that it didn't roll over
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function validate(values: FormValues): FormErrors {
    const errors: FormErrors = {};

    if (values.name.trim() === '') errors.name = 'Name is required.';

    const quantityText = values.quantity.trim().replace(',', '.');
    const quantity = Number(quantityText);
    if (quantityText === '' || !Number.isFinite(quantity) || quantity <= 0) errors.quantity = 'Enter a quantity greater than 0.';

    if (values.unit.trim() === '') errors.unit = 'Unit is required.';

    const date = values.expirationDate.trim();
    if (date !== '' && !isRealDate(date)) errors.expirationDate = 'Enter a valid date.';

    return errors;
}

// Form for adding or editing a pantry item
function PantryItemForm({ item }: { item?: PantryItem }) {
    const { colors } = useTheme();
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
    }

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
                />
                <Field
                    label="Quantity"
                    value={quantity}
                    onChangeText={setQuantity}
                    error={errors.quantity}
                    placeholder="ex. 500"
                    keyboardType="decimal-pad"
                />
                <Field
                    label="Unit"
                    value={unit}
                    onChangeText={setUnit}
                    error={errors.unit}
                    placeholder="ex. grams"
                    autoCapitalize="none"
                />
                <Field
                    label="Expiration date (optional)"
                    value={expirationDate}
                    onChangeText={setExpirationDate}
                    error={errors.expirationDate}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                />

                {saveError ? <Text style={{ color: colors.danger }}>{saveError}</Text> : null}
                <Button title={isSaving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={isSaving} />
                {item ? <Button title="Delete" variant="secondary" onPress={handleDelete} disabled={isBusy} /> : null}
            </Screen>
        </KeyboardAvoidingView>
    );
}

// Renders the pantry item screen
export default function PantryItemScreen() {
    const { colors } = useTheme();
    const params = useLocalSearchParams< {id? : string }>();
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