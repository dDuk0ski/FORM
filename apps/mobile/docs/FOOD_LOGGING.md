# Food search and logging (frontend)

Owner: Jake. Status (Nov 22): works end to end on **sample data and on-device storage**, the
default. With `EXPO_PUBLIC_USE_MOCKS=0` it uses Supabase with the schema on main, where
`food_logs.user_id` defaults to `auth.uid()` (`20261115200000_default_user_id_to_auth_uid.sql`).
Saving still needs a signed-in Supabase session (sign-in is mock today) and the migrations
applied to the hosted project (not verified); see `BACKEND_HANDOFF.md`. Built for Expo SDK 58 /
React Native 0.88.1 / RNTL 14.

## What the user can do

1. Open the **Log food** modal (`router.push('/log-food')`) and search. Results appear after 2+
   characters, with calories and macros for the default serving. The query matches the name or
   the brand, with the same order as `search_foods` on main: name-prefix matches, then other
   name matches, then brand-only matches, then shorter names (at most 25). `%`, `_` and `\`
   are plain characters in both modes (on main since
   `20261115200100_escape_search_foods_wildcards.sql`).
2. Tap a result to open **Add food** (`/food-detail`). Pick a meal, choose the food's serving or
   **Custom grams**, enter or step the amount, see the scaled nutrition, and tap **Add to log**.
3. Back in Log food, **Nutrition** and **Logged today** update immediately. Entries can be removed.
4. Close and reopen the app: the log is still there (stored on this device only).

Every screen handles loading, empty, no-results, invalid-input, success and error states.
Amounts must be 0.1 to 100 servings, or 1 to 5000 g for custom grams.

## On the Today tab

On main, Today's **Log food** button opens the Log food modal (`router.push('/log-food')`).
`<TodayNutrition />` (the Nutrition card and the Logged today list) lives in the modal, not on
Today. Covered by `src/__tests__/log-food-entry.test.tsx`.

Damjan's daily brief (PR #5, `ui/nutrition-demo`, not merged) replaces Today. Its **Meal** quick
action also routes to `/log-food`, so no food change is needed when it lands. The test for that
quick action is deferred until PR #5 merges. Its Fuel tile reads `GET /today`, which is a fixture
in mock mode, so it does not move when you log food; the modal's Nutrition card does. On main,
`GET /today` reads `daily_records`; PR #12 (open draft) switches it to `food_log_entries`. A patch
that feeds the Fuel tile from the food totals is kept outside the repo until PR #5 lands.

## How it is built

```
src/app/(modals)/log-food.tsx        search screen
src/app/(modals)/food-detail.tsx     serving + amount + add
src/components/food/                 FoodCard, MealPicker, ServingSelector, QuantityField, NutritionPreview,
                                     DailyNutritionCard, FoodLogList, SearchResults, FoodLogForm,
                                     TodayNutrition, DataSourceNotice, MacroLine, FoodSheetScreen,
                                     RoundBackButton, FoodSearchField, TabbedRow, AddCircle,
                                     foodTab (row tab color), softShadow
src/components/                      + SearchInput, ProgressBar, StateViews (shared, exported from the barrel)
src/hooks/                           useFoodSearch / useFood, useFoodLog (+ useLogFood, useRemoveLogEntry,
                                     useDailyNutrition), useDebouncedValue
src/lib/                             nutrition.ts (all the math), foodSearch.ts, dates.ts, errors.ts
src/api/foods.ts                     the one switch (EXPO_PUBLIC_USE_MOCKS); foods.types.ts = interface;
                                     foods.mock.ts = default; foods.supabase.ts = Supabase (names on main)
src/mocks/foods.ts                   sample foods (approximate values, not authoritative)
src/types/food.ts                    provisional frontend types
```

Rules followed: screens never call `fetch`, Supabase or AsyncStorage; colors come from the theme;
grams internally; UTC timestamps; no `user_id` anywhere on the client. Daily totals are always
the sum of the day's entries, never stored separately.

## Look (Christian's "Log food", "Add food" and "scan screen" frames)

- Log food and food detail use `FoodSheetScreen`: soft tinted top (`headerLogFood` green,
  `headerAddFood` blue), centered title, round white back button (same close / back action;
  still labelled "Close" on Log food), the device's local date, and content on a rounded white
  sheet. Still presented as iOS modals.
- Search is a grey filled pill with a search icon. "N results" shows above results only when
  there are results.
- Food rows (search results, Logged today, the food header on detail) are `TabbedRow`s: white
  rounded panel over a colored left tab, soft shadow. Foods have no category, so the tab color
  is one of four `foodTab*` tokens picked by a stable hash of the food id; it means nothing.
  The "+" on a search row is part of the row's button (it opens food detail like the row).
- The Nutrition card adds "X kcal left" / "Y eaten of Z" over the bars. With any unknown
  calories it shows "120 kcal+ eaten" or "— eaten" and no "left" number.
- System font (the frames use a geometric sans). Not in the frames on purpose: avatar, tab bar,
  category chips (no category data), "Today's Log" card, dark mode.

## How a log entry is stored (matches the agreed `food_logs` design)

A saved log row holds only: `id` (UUID made on the device), `food_id`, `logged_at`, `grams`,
`meal`, `source`, `serving_label`, `serving_quantity` and `deleted_at`. There is no food name, no
nutrient copy and no date column. The screens show an entry by joining the row to its food
(`hydrateLogEntry`): the name comes from the food, the nutrients are calculated from the food's
per-100 g values, and the day is the local day of `logged_at`. Removing an entry sets
`deleted_at` (a soft delete), and lists and totals skip those rows.

Custom grams are saved with `serving_label` and `serving_quantity` set to null.

The mock log is stored under the key `form.mock.food_log.v2`. Entries saved on a device by the
earlier build (`v1`) are not read and not deleted; they simply no longer appear.

## Unknown nutrients

The team agreed that a nutrient is stored per 100 g, and that null means unknown
(`is_known = false`). It is never 0. The food layer follows that rule everywhere:

- **Types.** `FoodMacros` in `src/types/food.ts` allows null for each of calories, protein, carbs
  and fat. It is used for a food's per-100 g values and for each log entry's nutrients. The
  shared `Macros` type in `src/types/api.ts` is unchanged, because GET /today and the Home tab
  use it and stay all-number.
- **Scaling.** `scaleMacros` keeps an unknown value null for any amount. It never becomes 0.
- **Totals.** `sumMacros` adds known values only. Each macro's total is `{ value, hasUnknown }`.
  `hasUnknown` is true when any entry had that macro unknown. `value` is null when there were
  entries but none had it known.
- **Display.** Every food component uses `formatNutrient`, `formatNutrientTotal` or
  `formatTotalAgainstTarget` from `src/lib/nutrition.ts`:
  - Unknown: "—", read by VoiceOver as "unknown".
  - Partial total (some entries unknown): the known sum with a plus, e.g. "120 g+" or
    "120+ / 175 g", read as "at least 120 grams, some entries unknown".
- **Progress bars.** Only known values fill a bar and decide whether a target is exceeded. A macro
  with nothing known shows "—" and an empty bar.

The sample foods in `src/mocks/foods.ts` have every value known, so in mock mode nothing shows
as unknown. The tests use test-only foods with null values. On main, `food_macros` and
`food_log_entries` return null for an unknown macro (`is_known = false`), and the Supabase
service keeps it null. The seed has 18 unknown nutrient values across its 57 foods.

## Barcode scanning

Status (Nov 26): works end to end in **mock mode** with fake sample barcodes. Real mode is not
connected: there is no server barcode route yet, so a lookup shows "Barcode lookup is not
connected to the server yet." with Retry. The app never calls Open Food Facts or any other URL.

### Flow

1. Log food → **Scan barcode** opens `/scan-barcode` (a modal).
2. Point the camera at an EAN-13, EAN-8, UPC-A or UPC-E barcode, **or** type the digits under
   **Or type the barcode** and tap **Look up**. Typed codes are checked first (empty, letters,
   wrong length, bad GS1 check digit each get an inline message).
3. "Looking up…", then:
   - **Found**: the scan modal is replaced by **Add food** (`/food-detail`) with
     `params: { id, source: 'barcode' }`, so the saved `food_logs` row has `source = 'barcode'`.
     Opened from search (no `source` param), it still saves `'manual'`.
   - **Not found**: "We couldn't find that product" with **Scan again** and **Search by name**
     (back to Log food).
   - **Error**: the message, **Retry**, **Scan again** and **Search by name**.

The camera accepts one valid scan at a time; repeats are ignored until **Scan again**, and the
same code is ignored for 2 seconds after it was accepted. Misreads (bad check digit) are ignored.

### Files

```
src/app/(modals)/scan-barcode.tsx      the screen (lookup states, navigation)
src/components/scanner/                BarcodeScanner (camera, permission states, frame), BarcodeEntry
                                       (typed field), scanGuard (one scan at a time), scannerColors
src/hooks/useBarcodeLookup.ts          TanStack Query mutation, retry off
src/lib/barcode.ts                     normalizeBarcode, isValidBarcode (GS1 check digit), parseBarcode,
                                       expandUpcE, toGtin14
src/api/barcode.ts                     the switch (same EXPO_PUBLIC_USE_MOCKS rule as foods.ts)
src/api/barcode.types.ts               BarcodeService, BarcodeNotAvailableError
src/api/barcode.mock.ts                fake sample barcodes → existing sample foods
```

`src/components/scanner/` knows nothing about food (it only reports a valid code), so the pantry
can reuse it later.

### Mock vs real mode

| Mode                             | `lookupBarcode(code)`                                               |
| -------------------------------- | ------------------------------------------------------------------- |
| Mock (default)                   | Sample map below; any other valid code resolves to null (not found) |
| Real (`EXPO_PUBLIC_USE_MOCKS=0`) | Rejects with `BarcodeNotAvailableError`; no network call            |

Sample barcodes are FAKE (GS1 prefix 2 is reserved for in-store use, never a branded product)
with valid check digits. They point at foods that already exist in `src/mocks/foods.ts`:

| Code            | Type   | Result                             |
| --------------- | ------ | ---------------------------------- |
| `2000000000015` | EAN-13 | Banana, raw                        |
| `2000000000022` | EAN-13 | Oats, rolled, dry                  |
| `200000000042`  | UPC-A  | Greek yogurt, plain, nonfat        |
| `20000004`      | EAN-8  | Whey protein powder                |
| `2000000000992` | EAN-13 | Valid, not in the map: "not found" |

### Testing on the iOS Simulator

The Simulator has no camera, so use the typed field with the codes above. Whether the Simulator
shows the "No camera available" message (via `CameraView` `onMountError`) or a blank camera area
is not verified; the typed field works either way. Camera scanning needs a real iPhone (Expo Go,
or a development build to show FORM's own permission text).

### Design

Matches Christian's `scan screen` mockup: black camera area, white rounded corner brackets, a
thin glowing green line across the middle (a slow pulse; static when Reduce Motion is on), a
muted-green caption pill, a round white back button, and a gray lower panel holding the typed
field. Differences: the title is "Scan barcode" (mockup: "Add"), the caption is "Fit the barcode
inside the frame" (mockup: receipt text), the tab bar and profile avatar are left out (it is a
modal), the frame sits fully inside the camera area, and the pill text is dark: white on the
frame's green is about 3.4:1, below the 4.5:1 WCAG AA minimum. The scanner always uses the dark
palette from `src/theme.ts`; the pill and line use the `scanHint` and `scanLine` tokens (mapping
in `src/components/scanner/scannerColors.ts`).

### Shared files changed for the scanner

- `package.json` / `package-lock.json`: `expo-camera` `~58.0.14` (via `npx expo install`), which
  also brings `barcode-detector`, `zxing-wasm` and `@types/emscripten` (its web fallback).
- `app.json`: the `expo-camera` config plugin with
  `cameraPermission: "FORM uses the camera to scan food barcodes."`. It takes effect in a native
  build (development build / TestFlight), not in Expo Go.
- `src/app/(modals)/log-food.tsx`: the **Scan barcode** button. `food-detail.tsx` and
  `FoodLogForm.tsx`: an optional `source` (default `'manual'`).

## Changes to shared files (Mason: please glance at these)

All additive; every existing default looks the same.

- `src/theme.ts`: Figma color tokens in both schemes, `radii.xlSoft` (24) and `radii.sheet` (32).
  PR #5 adds its own tokens (including `radii.xl: 22`) in the same object, so expect a text
  conflict there when it is rebased; keep both sets.
- `src/components/Button.tsx`: `soft` and `softOutline` variants. `Card.tsx`: `soft` variant.
- `src/components/ProgressBar.tsx` (new), `SearchInput.tsx` (new), `StateViews.tsx` (new). PR #5
  also adds a `ProgressBar.tsx` with a `value` / `max` API; the two need merging when it lands.
- `src/components/index.ts`: added exports for `ProgressBar`, `SearchInput`, `EmptyState`,
  `ErrorState`, `LoadingState`. No existing export changed.
- `src/components/Screen.tsx`: the `ScrollView` now has `keyboardShouldPersistTaps="handled"`, so a
  tap on a result works while the keyboard is open. No prop changes.
- `src/app/(modals)/log-food.tsx`: replaced the placeholder with the real screen.

## Checks

```bash
npx tsc --noEmit && npx eslint . --max-warnings 0 && npx jest --ci
```

After `npm start` has run once (it generates typed routes), `/food-detail` and `/scan-barcode`
are valid routes for `router.push`; an older generated `.expo/types/router.d.ts` makes
`tsc` reject `/scan-barcode` until `npm start` runs again. Run `npm run format` before committing.
