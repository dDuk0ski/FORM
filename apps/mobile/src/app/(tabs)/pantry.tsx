import { Screen } from '@/components';

// Pantry: what food the user has at home.
// TODO(Pantry): list pantry_items (food name, quantity_g, display_unit,
// expires_on, opened) from Supabase, soonest expiry first.
// TODO(Pantry): add an item by food search or barcode, with quantity and
// expiry date. Barcode lookup goes through the server (Open Food Facts, cached in `foods`).
// TODO(Pantry, stretch goal): receipt scanning — upload to Supabase Storage, then
// ml.parseReceipt (POST /receipt); confirm every item, flag confidence < 0.6.
export default function PantryScreen() {
  return <Screen title="Pantry" />;
}
