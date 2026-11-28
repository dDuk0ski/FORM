import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, OptionPills, type PillOption } from '@/components';
import { usePantry } from '@/hooks/usePantry';
import { categoryIcon, daysUntil, formatAmount } from '@/lib/pantry';
import { useTheme } from '@/theme';
import type { PantryItem } from '@/types/pantry';

// Pantry: what food the user has at home.
// TODO(Pantry): add an item by food search or barcode, with quantity and
// expiry date. Barcode lookup goes through the server (Open Food Facts, cached in `foods`).
// TODO(Pantry, stretch goal): receipt scanning — upload to Supabase Storage, then
// ml.parseReceipt (POST /receipt); confirm every item, flag confidence < 0.6.

type Category = 'all' | 'produce' | 'protein' | 'dairy' | 'bakery';

const CATEGORIES: PillOption<Category>[] = [
  { value: 'all', label: 'All' },
  { value: 'produce', label: 'Produce' },
  { value: 'protein', label: 'Protein' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'bakery', label: 'Bakery' },
];

// TODO(Pantry): placeholder, bar shows days until expiry out of 2 weeks
function freshness(item: PantryItem): number {
  if (!item.expiration_date) return 1;
  return Math.min(1, Math.max(0, daysUntil(item.expiration_date) / 14));
}

function PantryCard({ item }: { item: PantryItem }) {
  const { colors, spacing, radii, typography } = useTheme();
  const fill = freshness(item);
  const barColor = fill > 0.5 ? colors.progressGood : fill > 0.2 ? colors.progressWarning : colors.progressOver;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}, ${item.quantity} ${item.unit}`}
      onPress={() => router.push({ pathname: '/pantry-item', params: { id: item.id } })}
      style={({ pressed }) => ({
        flex: 1,
        height: 170,
        padding: spacing.md,
        borderRadius: radii.xlSoft,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: colors.surface,
        shadowColor: colors.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {/* circle that stretches into a pill for longer labels */}
      <View
        style={{
          alignSelf: 'flex-start',
          minWidth: 32,
          height: 32,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.pill,
          backgroundColor: colors.progressTrack,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]}>
          {formatAmount(item.quantity, item.unit)}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
        <SymbolView name={categoryIcon(item.category)} tintColor={colors.textMuted} size={36} />
        <Text numberOfLines={1} style={[typography.label, { color: colors.text, fontWeight: '600' }]}>
          {item.name}
        </Text>
      </View>

      {/* TODO(Pantry): kcal once items link to foods */}
      <View style={{ width: '90%', alignSelf: 'center', gap: spacing.xs }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Kcal: –</Text>
        <View style={{ height: 6, borderRadius: radii.pill, backgroundColor: colors.progressTrack, overflow: 'hidden' }}>
          <View style={{ width: `${fill * 100}%`, height: '100%', borderRadius: radii.pill, backgroundColor: barColor }} />
        </View>
      </View>
    </Pressable>
  );
}

export default function PantryScreen() {
  const { colors, spacing, radii, typography } = useTheme();
  const { data, isPending, error, refetch } = usePantry();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');

  const addItem = () => router.push('/pantry-item');

  const search = query.trim().toLowerCase();
  const items = (data ?? []).filter(
    (item) =>
      (category === 'all' || item.category?.toLowerCase() === category) &&
      (search === '' || item.name.toLowerCase().includes(search)),
  );
  const title = category === 'all' ? 'All items' : CATEGORIES.find((c) => c.value === category)?.label;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.headerPantry }}>
      <Text
        accessibilityRole="header"
        style={[typography.heading, { color: colors.text, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm }]}
      >
        Pantry
      </Text>

      {/* search + add */}
      <View style={{ width: '90%', alignSelf: 'center', flexDirection: 'row', gap: 10, marginTop: spacing.xl }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
          }}
        >
          <SymbolView name="magnifyingglass" tintColor={colors.textMuted} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search or add an item"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Search pantry"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[typography.body, { flex: 1, color: colors.text, paddingVertical: spacing.md }]}
          />
        </View>
        <Pressable
          onPress={addItem}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <SymbolView name="plus" tintColor={colors.text} size={20} />
        </Pressable>
      </View>

      {/* categories, centered but scrolls if they don't fit */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: spacing.md }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: '5%' }}
      >
        <OptionPills options={CATEGORIES} selected={category} onSelect={setCategory} accessibilityLabel="Category" />
      </ScrollView>

      {/* white sheet */}
      <View
        style={{
          flex: 1,
          marginTop: spacing.md,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radii.sheet,
          borderTopRightRadius: radii.sheet,
          paddingTop: spacing.xl,
        }}
      >
        <View
          style={{
            width: '90%',
            alignSelf: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
          }}
        >
          <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>{title}</Text>
          {data ? (
            <Text style={[typography.label, { color: colors.textMuted, fontWeight: '600' }]}>
              {items.length === 1 ? '1 item' : `${items.length} items`}
            </Text>
          ) : null}
        </View>

        {isPending ? (
          <ActivityIndicator accessibilityLabel="Loading pantry" style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <View style={{ width: '90%', alignSelf: 'center', gap: spacing.md }}>
            <Text style={[typography.body, { color: colors.danger }]}>{error.message}</Text>
            <Button title="Retry" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            // odd count gets an empty spacer so the last card stays half width
            data={items.length % 2 === 1 ? [...items, null] : items}
            keyExtractor={(item) => item?.id ?? 'spacer'}
            numColumns={2}
            renderItem={({ item }) => (item ? <PantryCard item={item} /> : <View style={{ flex: 1 }} />)}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ width: '90%', alignSelf: 'center', gap: 12, paddingBottom: spacing.xl }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
                {data.length === 0 ? 'Your pantry is empty. Tap + to add food!' : 'No items match'}
              </Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
