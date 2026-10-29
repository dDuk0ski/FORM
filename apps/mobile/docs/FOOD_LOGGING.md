# Food search and logging (frontend)

Owner: Jake. Status: works end to end on **sample data and on-device storage**. It is not connected
to the real backend; see `BACKEND_HANDOFF.md`.

## What the user can do

1. Open the **Log food** modal (`router.push('/log-food')`) and search. Results appear after 2+
   characters, with calories and macros for the default serving.
2. Tap a result to open **Add food** (`/food-detail`). Pick a meal, choose the food's serving or
   **Custom grams**, enter or step the amount, see the scaled nutrition, and tap **Add to log**.
3. Back in Log food, **Nutrition** and **Logged today** update immediately. Entries can be removed.
4. Close and reopen the app: the log is still there (stored on this device only).

Every screen handles loading, empty, no-results, invalid-input, success and error states.
Amounts must be 0.1 to 100 servings, or 1 to 5000 g for custom grams.

## On the Today tab

The Today screen has a **Log food** button and renders `<TodayNutrition />` under it: the day's
totals for all four macros with progress toward targets, and the list of logged foods.

Known mismatch while the ML service is mocked: the cards above it (`Eaten`, `Calories left`) come
from `GET /today`, which returns a fixed fixture, so they do not move when you log food. The
`Nutrition` card is computed from the log and does. Once the backend is real and `GET /today`
reads the same food logs, the two should agree. Until then, expect two different "eaten" numbers
on this screen, and decide with the team which one the demo shows (question 2 in
`BACKEND_HANDOFF.md`).

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
src/api/foods.ts                     the one swap point; foods.types.ts = interface; foods.mock.ts = today's implementation
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
as unknown. The tests use test-only foods with null values. The real nutrient shape
(`food_macros`, `is_known`) is not in the repo yet.

## Changes to shared files (Mason: please glance at these)

- `src/components/index.ts`: added exports for `ProgressBar`, `SearchInput`, `EmptyState`,
  `ErrorState`, `LoadingState`. No existing export changed.
- `src/components/Screen.tsx`: the `ScrollView` now has `keyboardShouldPersistTaps="handled"`, so a
  tap on a result works while the keyboard is open. No prop changes.
- `src/app/(modals)/log-food.tsx`: replaced the placeholder with the real screen.

## Checks

```bash
npm run typecheck && npm run lint && npm test
```

After `npm start` has run once (it generates typed routes), `/food-detail` is a valid route for
`router.push`. Run `npm run format` before committing.
