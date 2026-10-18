# Food search and logging (frontend)

Owner: Jake. Status: works end to end on **sample data and on-device storage**. It is not connected
to the real backend; see `BACKEND_HANDOFF.md`.

## What the user can do

1. Open the **Log food** modal (`router.push('/log-food')`) and search. Results appear after 2+
   characters, with calories and macros for the default serving.
2. Tap a result to open **Add food** (`/food-detail`). Pick a serving, enter or step the amount,
   see the scaled nutrition, and tap **Add to log**.
3. Back in Log food, **Today** and **Logged today** update immediately. Entries can be removed.
4. Close and reopen the app: the log is still there (stored on this device only).

Every screen handles loading, empty, no-results, invalid-input, success and error states.
Amounts must be 0.1 to 100 servings and at most 5000 g per entry.

## Adding it to the Today tab

`src/app/(tabs)/index.tsx` was not part of the files I received, so I did not edit it. To show the
dashboard and an entry point on Today:

```tsx
import { router } from 'expo-router';
import { Button } from '@/components';
import { TodayNutrition } from '@/components/food';

// inside the Today screen's <Screen>:
<Button title="Log food" onPress={() => router.push('/log-food')} />
<TodayNutrition />
```

Heads-up: the existing smoke test expects the mocked ML `consumed` numbers on Today (`2068 kcal`).
`TodayNutrition` shows consumed from the **log**, so Today would show two different "consumed"
figures. Decide with the team which one stays (question 4 in the backend handoff).

## How it is built

```
src/app/(modals)/log-food.tsx        search screen
src/app/(modals)/food-detail.tsx     serving + amount + add
src/components/food/                 FoodCard, ServingSelector, QuantityField, NutritionPreview,
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
