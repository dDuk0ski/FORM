# Backend handoff: food search and food logging

**For:** Joey (backend/API), Austen (database), Damjan (Today) **From:** Jake (frontend, food)
**Status:** updated Nov 13, 2026 against `origin/main` at `f3c4cd0`

The food screens run on sample data by default. With `EXPO_PUBLIC_USE_MOCKS=0` they use the
Supabase service in `src/api/foods.supabase.ts`, which follows the schema on main. Reads work once
there is a signed-in session. **Inserts stay blocked** until `food_logs.user_id` gets a default
(see "Still open"). The frontend does not and will not change any schema, migration, grant or RLS
policy.

Sources: I read the SQL and Python on `origin/main` and the PR threads on GitHub. I have not run
the migrations against the hosted Supabase project or called a deployed backend.

## What is merged

| PR                         | What                                                                              | Merged |
| -------------------------- | --------------------------------------------------------------------------------- | ------ |
| #1 `backend-initial-setup` | FastAPI backend: Supabase-token auth, `GET /today`                                | Nov 12 |
| #4 `db/schema-gaps`        | Check constraints, food views and search, workout and model tables, food seed     | Nov 12 |
| #6 `expo-upgrade`          | Expo SDK 58, React Native 0.88.1, RNTL 14.1.0, `@react-native/jest-preset` 0.88.1 | Nov 12 |

PR #5 (`ui/nutrition-demo`, Damjan's Today brief) is still open and still on SDK 57.

## The food schema on main

All under `supabase/migrations/`.

- **`foods`** (`20261022210543_add_foods_and_food_logs.sql`, `20261029170027_add_food_serving_label.sql`):
  `id`, `name`, `brand`, `source`, `source_id`, `barcode`, `serving_g`, `density`, `data_tier`,
  `serving_label`. `SELECT` for `authenticated`.
- **`food_logs`** (same file, plus `20261029170735_add_food_log_serving_and_soft_delete.sql`):
  `id`, `user_id` (NOT NULL, **no default**), `logged_at` (default `now()`), `meal` (nullable),
  `food_id`, `grams`, `source`, `serving_label`, `serving_quantity`, `deleted_at`.
- **`nutrients.code`** (`20261101180200_add_food_views_and_search.sql`): `NOT NULL` with the
  named constraint `nutrients_code_unique`. Existing rows get a code made from their name first.
- **`food_macros`** view (same file, `security_invoker`): `food_id`, `kcal_per_100g`,
  `protein_g_per_100g`, `carb_g_per_100g`, `fat_g_per_100g`. Only `is_known` rows are joined, so an
  unknown macro is null.
- **`food_log_entries`** view (same file, `security_invoker`): `id`, `user_id`, `logged_at`,
  `local_date`, `meal`, `source`, `food_id`, `food_name`, `brand`, `grams`, `serving_label`,
  `serving_quantity`, `kcal`, `protein_g`, `carb_g`, `fat_g`. Soft-deleted rows are excluded.
  `local_date` is `logged_at` in `profiles.timezone`, or UTC when that is null.
- **`search_foods(query TEXT, max_results INTEGER DEFAULT 25)`** (same file): matches `name` **or**
  `brand` (`ILIKE '%query%'`). Order: name-prefix matches, then other name matches, then brand-only
  matches, then shorter names, then name. At most 25 rows. `EXECUTE` for `authenticated` and
  `service_role` only.
- **CHECK constraints** (`20261101180000_add_check_constraints.sql`): `meal IN ('breakfast',
'lunch', 'dinner', 'snack')`, `source IN ('manual', 'barcode', 'recipe', 'predicted')`,
  `grams > 0`, `serving_quantity > 0`, `food_nutrients.is_known = (amount_per_100g IS NOT NULL)`,
  `amount_per_100g >= 0`.
- **Seed** (`supabase/seed.sql`, built by `scripts/build_food_seed.py` from USDA SR Legacy): 57
  foods, 22 nutrients, 1,254 `food_nutrients` rows, 18 of them unknown (`NULL`, `is_known = false`).
  No food has a brand. 56 foods have `serving_g` and `serving_label`; "Greek yogurt, whole milk,
  plain" has neither, so the app offers only custom grams for it.

### What the PR #4 review commit (`3ea76a9`) changed

- `nutrients.code` became `NOT NULL` (it was only `UNIQUE`).
- `search_foods` matches the brand as well as the name, with the order above.
- Workout sets: `CHECK (set_index >= 1)` and a partial unique index on
  `(workout_exercise_id, set_index) WHERE deleted_at IS NULL`. The old `sets`, `reps` and `weight`
  columns on `workout_exercises` are gone.
- Training preferences allow 1 to 6 days.
- A shared `set_updated_at()` trigger on `training_preferences` and `model_state`.

## How the app uses it

`src/api/foods.supabase.ts`:

| Operation   | Call                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Search      | `rpc('search_foods', { query, max_results: 25 })`, server order kept. Nothing is sent under 2 characters                                                                       |
| Food detail | `foods` (`id, name, brand, serving_g, serving_label`) and `food_macros` by `food_id`                                                                                           |
| Day's log   | `food_log_entries` where `local_date = <date>`, ordered by `logged_at`                                                                                                         |
| Add         | `food_logs` insert of `id` (made on the device), `food_id`, `grams`, `meal`, `source`, `serving_label`, `serving_quantity`, `logged_at`; a retry with the same `id` is ignored |
| Remove      | `food_logs` update `deleted_at = now` where `id = <id>` and `deleted_at is null`                                                                                               |

The app never sends `user_id`. Unknown nutrients stay null and are shown as "—", never 0. Daily
totals are summed on the device from the day's entries (known values only, with a partial flag).

The mock search (`src/lib/foodSearch.ts`) follows the same rules as `search_foods`, so results
look the same in both modes.

## Still open

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                       | Owner         | Where                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **`food_logs.user_id` has no default.** Every insert from the app fails with a not-null error until it is `DEFAULT auth.uid()` (or equivalent). The app shows "Saving to your account is not available yet."                                                                                                                                                                                               | Austen        | `20261022210543_add_foods_and_food_logs.sql`                                                     |
| 2   | **Hard delete is still allowed.** `authenticated` still has `DELETE` on `food_logs` and the "Users can delete their own food logs" policy is still there. The app only soft-deletes. Keep or drop?                                                                                                                                                                                                         | Austen        | `20261023220022_add_authenticated_food_grants.sql`, `20261022211716_add_foods_food_logs_rls.sql` |
| 3   | **`meal` is nullable.** The CHECK passes on null. The app always sends a meal and refuses a null-meal row it reads. Make it `NOT NULL`?                                                                                                                                                                                                                                                                    | Austen        | `20261022210543_add_foods_and_food_logs.sql`                                                     |
| 4   | **`search_foods` does not escape `%` and `_`.** A query containing them acts as a wildcard.                                                                                                                                                                                                                                                                                                                | Austen        | `20261101180200_add_food_views_and_search.sql`                                                   |
| 5   | **Migrations applied to the hosted project: unverified.** PR #4 asked for them to be applied with `supabase db push` and the seed loaded. Nothing in the repo shows it was done.                                                                                                                                                                                                                           | Austen        | PR #4 thread                                                                                     |
| 6   | **`GET /today` uses the server's date** (`date.today()`, UTC on a host), has no `date` parameter, and reads `consumed` from `daily_records`, not `food_log_entries`. It lacks `tdee_estimate`, `target_source`, `rationale`, `protein_split`, `micronutrient_flags`, `log_quality` and `stub`, and `readiness` is a number, not `{ score, advice }` (`src/types/api.ts`). Errors are FastAPI `{ detail }`. | Joey          | `backend/routers/today.py`                                                                       |
| 7   | **Nothing writes `profiles.timezone`**, so `local_date` is the UTC day for everyone. Mock mode uses the device's day. Which day is "today", and who sets the timezone?                                                                                                                                                                                                                                     | Damjan / team | `20261029161904_add_profile_fields.sql`                                                          |
| 8   | **No sign-in on any branch.** Only `TODO(auth)` comments in `src/app/_layout.tsx` and `src/api/supabase.ts`. Real calls need a session.                                                                                                                                                                                                                                                                    | Unassigned    |                                                                                                  |
| 9   | **Today totals.** Today's numbers come from `GET /today`; the Nutrition card sums the log. They disagree until `/today` reads `food_log_entries`.                                                                                                                                                                                                                                                          | Joey, Damjan  |                                                                                                  |

Damjan's review of PR #1 (Nov 11) asks Joey for the same `/today` changes as item 6.

## Frontend files that consume the contract

| File                        | Role                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `src/api/foods.ts`          | The one switch: mock by default, Supabase when `EXPO_PUBLIC_USE_MOCKS=0`                   |
| `src/api/foods.types.ts`    | `FoodService`: `searchFoods`, `getFood`, `listLogEntries`, `addLogEntry`, `removeLogEntry` |
| `src/api/foods.supabase.ts` | Supabase implementation (this document)                                                    |
| `src/api/foods.mock.ts`     | Sample data and on-device log, used by default and in tests                                |
| `src/lib/nutrition.ts`      | Scaling, known-only totals, formatting of unknown and partial values                       |
| `src/types/food.ts`         | `Food`, `FoodLogEntry`, `NewFoodLog`; `MEAL_TYPES` and `LOG_SOURCES` match the CHECKs      |
