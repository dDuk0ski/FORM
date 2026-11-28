import { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, OptionPills, SegmentedPill, type PillOption } from '@/components';
import {
  useAddPantryItem,
  usePantry,
  useRemovePantryItem,
  useUpdatePantryItem,
} from '@/hooks/usePantry';
import {
  categoryIcon,
  expiresInLabel,
  formatAmount,
  gramsFor,
  toPantryUnit,
  type PantryCategory,
  type PantryUnit,
} from '@/lib/pantry';
import { useTheme, withAlpha } from '@/theme';
import type { PantryItem } from '@/types/pantry';
import type { IsoDate } from '@/types/api';

const CATEGORIES: PillOption<PantryCategory>[] = [
  { value: 'produce', label: 'Produce' },
  { value: 'protein', label: 'Protein' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'other', label: 'More' },
];

const UNITS: PillOption<PantryUnit>[] = [
  { value: 'pcs', label: 'pcs' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'pack', label: 'pack' },
];

const STEP_SIZE = 36;

type FormValues = {
  name: string;
  quantity: string;
  unit: PantryUnit | null;
  calories: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function toNumber(text: string): number {
  return Number(text.trim().replace(',', '.'));
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.name.trim() === '') errors.name = 'Name is required.';

  const quantityText = values.quantity.trim().replace(',', '.');
  const quantity = Number(quantityText);
  if (quantityText === '' || !Number.isFinite(quantity) || quantity <= 0)
    errors.quantity = 'Enter a quantity greater than 0.';
  else if (quantity > 9999) errors.quantity = 'Enter a quantity up to 9999.';
  else if (!/^\d+(\.\d)?$/.test(quantityText)) errors.quantity = 'Use at most 1 decimal place.';

  if (values.unit === null) errors.unit = 'Pick a unit.';

  const calories = toNumber(values.calories);
  if (values.calories.trim() !== '' && (!Number.isFinite(calories) || calories < 0 || calories > 9999))
    errors.calories = 'Enter calories between 0 and 9999.';

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

function shortDate(value: string): string {
  return toDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Label({ children }: { children: string }) {
  const { colors, typography } = useTheme();
  return <Text style={[typography.label, { color: colors.text, fontWeight: '600' }]}>{children}</Text>;
}

function ErrorText({ children }: { children?: string }) {
  const { colors, typography } = useTheme();
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>
      {children}
    </Text>
  );
}

// Form for adding or editing a pantry item
function PantryItemForm({ item }: { item?: PantryItem }) {
  const { colors, spacing, radii, typography } = useTheme();
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<PantryCategory | null>(
    (item?.category as PantryCategory | null) ?? null,
  );
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '1');
  const [unit, setUnit] = useState<PantryUnit | null>(item ? toPantryUnit(item.unit) : 'pcs');
  // TODO(Pantry): calories aren't saved yet
  const [calories, setCalories] = useState('');
  const [expirationDate, setExpirationDate] = useState<string>(item?.expiration_date ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const [draftDate, setDraftDate] = useState(new Date());
  const [showErrors, setShowErrors] = useState(false);

  const router = useRouter();
  const addItem = useAddPantryItem();
  const removeItem = useRemovePantryItem();
  const updateItem = useUpdatePantryItem();
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSaving = addItem.isPending || updateItem.isPending;
  const isBusy = isSaving || removeItem.isPending;

  const allErrors = validate({ name, quantity, unit, calories });
  const errors = showErrors ? allErrors : {};
  const amount = allErrors.quantity || unit === null ? null : formatAmount(toNumber(quantity), unit);

  const stepQuantity = (sign: -1 | 1) => {
    const current = Number.isFinite(toNumber(quantity)) ? toNumber(quantity) : 0;
    const next = Math.min(9999, Math.max(1, Math.round(current) + sign));
    setQuantity(String(next));
  };

  const openPicker = () => {
    Keyboard.dismiss();
    setDraftDate(expirationDate ? toDate(expirationDate) : new Date());
    setShowPicker(true);
  };

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
    if (Object.keys(allErrors).length > 0 || unit === null) return;

    setSaveError(null);
    const qty = toNumber(quantity);
    const values = {
      name: name.trim(),
      quantity: qty,
      unit,
      grams: gramsFor(qty, unit),
      category,
      expiration_date: expirationDate === '' ? null : (expirationDate as IsoDate),
    };

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, patch: values });
      } else {
        await addItem.mutateAsync(values);
      }
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save. Try again.');
    }
  };

  const fieldStyle = {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  };

  return (
    // scrolls the focused field above the keyboard, tapping empty space closes it
    <ScrollView
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      alwaysBounceVertical={false}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg }}
    >
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.text, fontWeight: '700' }]}>
          {item ? 'Edit Item' : 'Add to Pantry'}
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <SymbolView name="xmark" tintColor={colors.text} size={20} />
        </Pressable>
      </View>

      {item ? (
        <View
          style={{
            alignSelf: 'center',
            width: 96,
            height: 96,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SymbolView name={categoryIcon(category)} tintColor={colors.textMuted} size={48} />
        </View>
      ) : null}

      {/* name */}
      {/* TODO(Pantry): "Found it" text, once names match foods */}
      <View style={{ gap: spacing.xs }}>
        <Label>Name</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="ex. Greek yogurt"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Name"
          style={[
            fieldStyle,
            typography.body,
            {
              fontWeight: '700',
              color: colors.text,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderColor: errors.name ? colors.danger : colors.cardBorder,
            },
          ]}
        />
        <ErrorText>{errors.name}</ErrorText>
      </View>

      {/* category */}
      <View style={{ gap: spacing.sm }}>
        <Label>Category</Label>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ marginHorizontal: -spacing.xl }}
          contentContainerStyle={{ paddingHorizontal: spacing.xl }}
        >
          <OptionPills options={CATEGORIES} selected={category} onSelect={setCategory} accessibilityLabel="Category" />
        </ScrollView>
      </View>

      {/* quantity + unit */}
      <View style={{ gap: spacing.sm }}>
        <Label>Quantity</Label>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View
            style={[
              fieldStyle,
              {
                width: '40%',
                height: 50,
                borderRadius: radii.pill,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 6,
                borderColor: errors.quantity ? colors.danger : colors.cardBorder,
              },
            ]}
          >
            <Pressable
              onPress={() => stepQuantity(-1)}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              style={{
                width: STEP_SIZE,
                height: STEP_SIZE,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolView name="minus" tintColor={colors.text} size={16} />
            </Pressable>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              accessibilityLabel="Quantity"
              selectTextOnFocus
              style={[typography.body, { flex: 1, textAlign: 'center', fontWeight: '700', color: colors.text }]}
            />
            <Pressable
              onPress={() => stepQuantity(1)}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              style={{
                width: STEP_SIZE,
                height: STEP_SIZE,
                borderRadius: radii.pill,
                backgroundColor: colors.text,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolView name="plus" tintColor={colors.surface} size={16} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <SegmentedPill options={UNITS} selected={unit} onSelect={setUnit} accessibilityLabel="Unit" />
          </View>
        </View>
        <ErrorText>{errors.quantity ?? errors.unit}</ErrorText>
      </View>

      {/* calories + expires */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Label>Calories per item</Label>
          <View
            style={[
              fieldStyle,
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                height: 50,
                borderColor: errors.calories ? colors.danger : colors.cardBorder,
              },
            ]}
          >
            <TextInput
              value={calories}
              onChangeText={setCalories}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Calories per item"
              style={[typography.body, { flex: 1, fontWeight: '700', color: colors.text }]}
            />
            <Text style={[typography.caption, { color: colors.textMuted }]}>kcal</Text>
          </View>
        </View>

        <View style={{ flex: 1, gap: spacing.xs }}>
          <Label>Expires</Label>
          <Pressable
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel="Expiration date"
            accessibilityValue={{ text: expirationDate ? shortDate(expirationDate) : 'No date' }}
            style={[fieldStyle, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: 50 }]}
          >
            <SymbolView name="calendar" tintColor={colors.textMuted} size={18} />
            <Text
              style={[
                typography.body,
                { flex: 1, fontWeight: expirationDate ? '700' : '400', color: expirationDate ? colors.text : colors.textMuted },
              ]}
            >
              {expirationDate ? shortDate(expirationDate) : 'None'}
            </Text>
            {expirationDate ? (
              <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '600' }]}>
                {expiresInLabel(expirationDate)}
              </Text>
            ) : null}
          </Pressable>
        </View>
      </View>
      <ErrorText>{errors.calories}</ErrorText>

      {saveError ? <ErrorText>{saveError}</ErrorText> : null}
      <Button
        variant="soft"
        title={isSaving ? 'Saving…' : item ? 'Save changes' : amount ? `Add ${amount} to pantry` : 'Add to pantry'}
        onPress={handleSave}
        disabled={isBusy}
      />
      {item ? (
        <Pressable onPress={handleDelete} disabled={isBusy} accessibilityRole="button" style={{ alignSelf: 'center' }}>
          <Text style={[typography.label, { color: colors.danger, fontWeight: '600' }]}>Delete item</Text>
        </Pressable>
      ) : null}

      {/* calendar popup, Done commits the date */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
          <Pressable
            onPress={() => setShowPicker(false)}
            accessibilityLabel="Close date picker"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: withAlpha(colors.shadow, 0.4) }}
          />
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm }}>
              <Pressable onPress={() => setShowPicker(false)} accessibilityRole="button" hitSlop={12}>
                <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setExpirationDate(toIsoString(draftDate));
                  setShowPicker(false);
                }}
                accessibilityRole="button"
                hitSlop={12}
              >
                <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="inline"
              accentColor={colors.primary}
              onValueChange={(_event, selected) => {
                if (selected) setDraftDate(selected);
              }}
            />
            {expirationDate ? (
              <Pressable
                onPress={() => {
                  setExpirationDate('');
                  setShowPicker(false);
                }}
                accessibilityRole="button"
                style={{ alignSelf: 'center', padding: spacing.sm }}
              >
                <Text style={[typography.label, { color: colors.danger }]}>Remove date</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// Renders the pantry item sheet
export default function PantryItemScreen() {
  const { colors, spacing, typography } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { data, isLoading } = usePantry();

  // Add item
  if (id === undefined) return <PantryItemForm />;

  // Edit item
  if (isLoading) return <ActivityIndicator style={{ padding: spacing.xxl }} />;

  const item = data?.find((entry) => entry.id === id);
  if (!item) {
    return (
      <Text style={[typography.body, { color: colors.textMuted, padding: spacing.xl }]}>
        This item could not be found.
      </Text>
    );
  }

  return <PantryItemForm key={item.id} item={item} />;
}
