# Food search and logging (frontend)

Owner: Jake. Status (Nov 13): works end to end on **sample data and on-device storage**, the
default. With `EXPO_PUBLIC_USE_MOCKS=0` it uses Supabase with the schema on main, but saving is
blocked until `food_logs.user_id` has a default and there is no sign-in yet; see
`BACKEND_HANDOFF.md`. Built for Expo SDK 58 / React Native 0.88.1 / RNTL 14.

## What the user can do

1. Open the **Log food** modal (`router.push('/log-food')`) and search. Results appear after 2+
   characters, with calories and macros for the default serving. The query matches the name or
   the brand, with the same order as `search_foods` on main: name-prefix matches, then other
   name matches, then brand-only matches, then shorter names (at most 25).
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
in mock mode, so it does not move when you log food; the modal's Nutrition card does. A patch
that feeds the Fuel tile from the food totals is kept outside the repo until PR #5 lands.

## How it is built

```
src/app/(modals)/log-food.tsx        search screen
src/app/(modals)/food-detail.tsx     serving + amount + add
src/components/food/                 FoodCard, MealPicker, ServingSelector, QuantityField, NutritionPreview,
                                     DailyNutritionCard, FoodLogList, SearchResults, FoodLogForm,
                                     TodayNutrition, DataSourceNotice, MacroLine
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

After `npm start` has run once (it generates typed routes), `/food-detail` is a valid route for
`router.push`. Run `npm run format` before committing.
