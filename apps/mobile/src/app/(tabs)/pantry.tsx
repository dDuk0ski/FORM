import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { Button, Card, Row, Screen } from '@/components';
import { usePantry } from '@/hooks/usePantry';
import { useTheme } from '@/theme';

// Pantry: what food the user has at home.
// TODO(Pantry): list pantry_items (food name, quantity_g, display_unit,
// expires_on, opened) from Supabase, soonest expiry first.
// TODO(Pantry): add an item by food search or barcode, with quantity and
// expiry date. Barcode lookup goes through the server (Open Food Facts, cached in `foods`).
// TODO(Pantry, stretch goal): receipt scanning — upload to Supabase Storage, then
// ml.parseReceipt (POST /receipt); confirm every item, flag confidence < 0.6.

// days from today until a "YYYY-MM-DD" date. negative means already expired
function daysUntil(date: string): number {
  const ms = new Date(`${date}T00:00:00`).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export default function PantryScreen() {
  const { colors, typography } = useTheme();
  const { data, isPending, error, refetch } = usePantry();

  const addItem = () => router.push('/pantry-item');

  return (
    <Screen title="Pantry">
      {isPending ? (
        <ActivityIndicator accessibilityLabel="Loading pantry" />
      ) : error ? (
        <Card>
          <Text style={[typography.body, { color: colors.danger }]}>{error.message}</Text>
          <Button title="Retry" variant="secondary" onPress={() => refetch()} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <Text style={[typography.heading, { color: colors.text }]}>Your pantry is empty</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Add food from your pantry!
          </Text>
        </Card>
      ) : (
        data.map((item) => {
          const days = item.expiration_date ? daysUntil(item.expiration_date) : null;
          const expired = days !== null && days < 0;
          const soon = days !== null && days >= 0 && days <= 3;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
              onPress={() => router.push({ pathname: '/pantry-item', params: { id: item.id } })}
            >
              <Card>
                <Row label={item.name} value={`${item.quantity} ${item.unit}`} />
                {days !== null ? (
                  <Text
                    style={[
                      typography.caption,
                      { color: expired ? colors.danger : soon ? colors.warning : colors.textMuted },
                    ]}
                  >
                    {expired ? 'Expired' : days === 0 ? 'Expires today' : days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          );
        })
      )}
      <Button title="Add item" onPress={addItem} />
    </Screen>
  );
}
