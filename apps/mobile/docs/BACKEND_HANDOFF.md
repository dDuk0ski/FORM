# Backend handoff: food search and food logging

**For:** Joey and Austen **From:** Jake (frontend) **Status:** mock-backed; updated Oct 29 against the repo and the Oct 25 team decisions

The food search / logging screens are finished and run on sample data and on-device storage.
They need a real backend before they can ship. This note separates **facts** (what the files in
the repo show), **team decisions** (agreed Oct 25, relayed in writing, not yet in the repo) and
**assumptions** (my guesses, marked as such). The frontend does not and will not change any
schema, migration, grant or RLS policy.

## Status as of Oct 29

Sources: `main` at `16b5729` (migrations), `backend-initial-setup` at `40b0c41`
(`backend/routers/today.py`). I read the files. I have not run the backend or queried the live
database, so anything about the live Supabase project is marked unverified.

### Facts: confirmed in the repo

| Item         | What the files show                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foods`      | `id` (uuid), `name`, `brand`, `source`, `source_id`, `barcode`, `serving_g`, `density`, `data_tier`, and now `serving_label` (nullable). `SELECT` for `authenticated`.                                    |
| `food_logs`  | `id`, `user_id`, `logged_at`, `meal`, `food_id`, `grams`, `source`, and now `serving_label`, `serving_quantity`, `deleted_at` (all nullable). No date column. Select, insert, update, delete on own rows. |
| `profiles`   | Now has `sex`, `birth_date`, `height_cm`, `goal`, `activity_level`, `units`, `timezone`, `is_premium`. Created at signup by `handle_new_user`; no backfill for older accounts.                            |
| Grants       | `20261023220022_add_authenticated_food_grants.sql`: `SELECT` on `foods`, `SELECT/INSERT/UPDATE/DELETE` on `food_logs`, for `authenticated`.                                                               |
| `GET /today` | On `backend-initial-setup` only. `consumed` comes from `daily_records`, not `food_logs`.                                                                                                                  |

Austen reported on Discord (Oct 23) that the signup trigger and grants are applied to the live
project. I have not verified that.

### Team decisions (Oct 25, from the meeting notes; not yet in the repo)

- The app reads and writes user data directly through Supabase; FastAPI is only for computed endpoints.
- Nutrients go in new `nutrients` and `food_nutrients` tables, per 100 g. Unknown values are null
  with `is_known = false`, never 0.
- A `food_macros` view and a `search_foods(query, limit)` function (max 25 results).
- One default serving per food (`serving_label`) plus custom grams.
- `food_logs` stores food id and grams, `serving_label`, `serving_quantity`, `deleted_at`. Deletes
  are soft. No name or macro copies.
- The app generates entry UUIDs, so retries cannot duplicate.
- `meal`: breakfast / lunch / dinner / snack. `source`: manual / barcode / recipe / predicted.
  Enforced in the database.
- Joey is holding the `/today` food-log update until the storage model is settled.

### Still missing from the repo (blocks the real connection)

1. **No nutrient data.** `nutrients`, `food_nutrients`, `food_macros` and `search_foods` are not in any
   migration. Without them the app cannot show calories on search results, preview a serving, or
   compute totals. It will not show unknown values as zero.
2. **No grants for the new objects.** The existing grants cover only `foods` and `food_logs`.
3. **No `CHECK` on `meal` and `source`.**
4. **No seed data.** `foods` is empty until someone loads it.
5. **No sign-in screen or owner.** Real calls need a session; with mocks off and no session the app
   shows "Not signed in."
6. **`GET /today` shape.** It does not match `src/types/api.ts` (table below), and it ignores the
   `date` parameter.

`GET /today` against `TodayResponse` in `src/types/api.ts`:

| Field                                                 | `types/api.ts`                 | Backend today                            |
| ----------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| `readiness`                                           | `{ score, advice }`            | a number, or `null`                      |
| `targets`, `remaining`                                | numbers                        | each value can be `null` (no target row) |
| `tdee_estimate`, `target_source`, `rationale`         | present                        | not returned                             |
| `protein_split`, `micronutrient_flags`, `log_quality` | present                        | not returned                             |
| `date` query parameter                                | supported                      | ignored; the server uses its own date    |
| error body                                            | `{ error: { code, message } }` | FastAPI `{ detail }`                     |

The Today screen reads `data.readiness.score`, so a `null` readiness would throw. I have not
changed the frontend for this, because the endpoint is still in progress.

### Double counting

`/today` takes `consumed` from `daily_records`, a nightly rollup of the same logs. If Joey adds
`food_logs` to `/today` while `daily_records` also covers them, food would be counted twice. The
app sums its own entries for the Nutrition card and shows `/today` for targets and the cards above
it, so until there is one source, the Today screen can show two different "eaten" numbers.

## What is integrated, and what is not

**Integrated with the backend: nothing.** Every call goes to the mock service.

**Mock-backed, already shaped like the agreed design:**

- Log rows hold only `id`, `food_id`, `logged_at`, `grams`, `meal`, `source`, `serving_label`,
  `serving_quantity` and `deleted_at`. The name and nutrients are joined from the food on every read.
- Removing an entry sets `deleted_at`; lists and totals skip deleted rows.
- Entry ids are version 4 UUIDs created on the device.
- Each food has one default serving, plus a "Custom grams" choice. Custom grams are saved with no
  serving label or quantity.
- The person picks a meal (default suggested by the time of day) and `source` is `manual`.
- The day an entry counts toward is the device's local day of `logged_at`.

**Not built yet, because the shapes are not in the repo:** the real service, null (unknown)
nutrient display, and a signed-in session. See "Assumptions" below.

## A. Food search: what the UI needs

Per the Oct 25 decisions: `search_foods(query, limit)` with a maximum of 25 results. The UI sends
nothing under 2 characters.

What each result must provide (the fields the screens read):

| Field           | Type                           | Notes                                                                                                                                 |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string                         | stable food id                                                                                                                        |
| `name`          | string                         | shown as the result title                                                                                                             |
| `brand`         | string or null                 |                                                                                                                                       |
| nutrients       | kcal, protein_g, carb_g, fat_g | **per 100 g**; unknown must stay unknown (null), never 0                                                                              |
| default serving | `serving_label` + `serving_g`  | e.g. `1 medium (118 g)` = 118 g. Both are nullable in the schema today; the UI falls back to custom grams only when either is missing |

The UI also needs "get one food by id" for the detail screen, or search results complete enough
to reuse. An empty result must be an empty list, not an error.

## B. Food log: the row the app writes

Matches the Oct 25 decisions and the current `food_logs` columns. The app sends:

| Field                               | Notes                                                     |
| ----------------------------------- | --------------------------------------------------------- |
| `id`                                | UUID generated on the device, so a retry cannot duplicate |
| `food_id`                           |                                                           |
| `logged_at`                         | ISO 8601 UTC                                              |
| `grams`                             | total grams eaten                                         |
| `meal`                              | `breakfast`, `lunch`, `dinner` or `snack`                 |
| `source`                            | `manual` for everything the app does today                |
| `serving_label`, `serving_quantity` | what the person picked; both null for custom grams        |

`user_id` is never sent: the database sets it from the session. `deleted_at` is set by the delete,
not by the insert. The app stores no food name, no nutrient copies and no date. The name and
nutrients come from joining the food; the day comes from `logged_at`.

Operations: list a local day's entries oldest first (excluding `deleted_at`), insert one
(idempotent on `id`), soft delete one (set `deleted_at`).

## C. Daily totals

Today the app **sums the day's entries on the device** from the joined entries, so totals can
never disagree with the list above them. Options for you to choose between:

1. Keep summing on the client (current behavior; nothing to build).
2. A view or RPC that returns totals for a date.
3. Take `consumed` from ML `GET /today`, which already exists in `types/api.ts`.

Please do not run two sources side by side: the Today screen would show two different "consumed"
numbers. **Targets** (calories and macros per day) are currently read from `GET /today` →
`targets`. If they should live in a table instead, I need that table and its fields.

## D. Identity and row ownership

The app signs in with Supabase Auth and `supabase-js` attaches the session token to every call.
Proposal: `food_logs.user_id` defaults to `auth.uid()` and has per-user RLS policies matching the
existing `pantry_items` ones (`auth.uid() = user_id` for select, insert, update, delete). The
frontend never sends a `user_id` to any endpoint (README rule). I need to know whether
`foods` is readable by every signed-in user (like `exercises` is today).

## E. Backend items that need your review

- **Nutrients.** `nutrients`, `food_nutrients`, `food_macros` and `search_foods` are decided but not in
  the repo. I need their exact column names, units and the `is_known` handling.
- **Grants.** Add `SELECT` on the new view, tables and `EXECUTE` on `search_foods` for `authenticated`.
  Confirm on the live project that the current grants are applied.
- **Seed data.** Who loads `foods`, and when?
- **Profile backfill.** The trigger only covers new signups.
- **`food_logs` constraints.** Add the `CHECK` for `meal` and `source` values, and say whether both
  are required (the columns exist; I cannot tell from the migrations).
- **Row ownership on insert.** Confirm `user_id` defaults to `auth.uid()` so the app never sends it.

I have written no SQL for any of these.

## F. Frontend files that will consume the final contract

| File                                                    | What changes                                                                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/foods.ts`                                      | Swap `foodService` and `FOOD_DATA_SOURCE` to the real implementation. **This is the only switch.**                                                               |
| `src/api/foods.types.ts`                                | `FoodService` is the interface to implement: `searchFoods`, `getFood`, `listLogEntries`, `addLogEntry`, `removeLogEntry`                                         |
| `src/api/foods.mock.ts`                                 | Stays as the mock/test implementation, or is deleted                                                                                                             |
| `src/lib/nutrition.ts`                                  | `hydrateLogEntry` joins a log row to its food; the real service can reuse it                                                                                     |
| `src/lib/dates.ts`                                      | `localDayRangeUtc(date)` gives the `logged_at` range for a local day                                                                                             |
| `src/types/food.ts`                                     | `NewFoodLog` and `StoredFoodLog` mirror `food_logs`. `Food` and `FoodLogEntry` are what the screens read; adapt the real response to them inside the new service |
| `src/hooks/useFoodSearch.ts`, `src/hooks/useFoodLog.ts` | Query keys, `retry: false`, and invalidation. Revisit retry once there is a real network                                                                         |
| `src/components/food/TodayNutrition.tsx`                | Where targets and totals are combined (see C)                                                                                                                    |
| `src/components/food/DataSourceNotice.tsx`              | The "Sample data" banner hides itself when `FOOD_DATA_SOURCE` is no longer `'mock'`                                                                              |
| `src/types/api.ts`                                      | Only if the ML contract changes (it is shared with the ML service and its fixtures)                                                                              |

Screens in `src/app/(modals)/` should not need to change. The food components will need one
change when unknown nutrients exist: show "unknown" instead of a number.

### Assumptions I will confirm before building the real service

These are guesses, not facts:

- Search calls `search_foods(query, limit)` through `supabase.rpc`.
- Nutrients per 100 g come from `food_macros`, with an unknown flag per value.
- A day's log is read with `logged_at >= start and < end` from `localDayRangeUtc(date)`, and
  `deleted_at is null`.
- A delete is an `update` that sets `deleted_at`.
- "Today" is the device's local day. Whether it should use `profiles.timezone` instead is open.

## G. Questions we need to decide

Resolved by the repo or the Oct 25 decisions (no need to answer): foods live in Supabase Postgres;
the app talks to Supabase directly; ids are UUIDs created by the app; deletes are soft; one default
serving plus custom grams.

Still open:

1. **Nutrient shape.** Column names and units of `food_macros` and `search_foods`, and how unknown
   values are returned.
2. **`GET /today`.** Will it match `types/api.ts` or will `types/api.ts` change? Which single
   source feeds `consumed` (`food_logs` or `daily_records`) so nothing is counted twice?
3. **Local day.** Should the app use the device's day or `profiles.timezone`? `food_logs` has no
   date column.
4. **Required fields.** Are `meal` and `source` required on insert, and what does the `CHECK` allow?
5. **Seeding and grants** for the new objects (section E).
6. **Sign-in.** Who owns the sign-in screens? Real calls need a session.
7. **Missing serving.** `serving_label` and `serving_g` are nullable. Is every seeded food guaranteed
   to have both?
8. **Errors.** Which error body should the app expect from FastAPI (`{ detail }` now)?
