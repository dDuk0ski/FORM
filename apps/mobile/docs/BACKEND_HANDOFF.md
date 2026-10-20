# Backend handoff: food search and food logging

**For:** Joey and Austen **From:** Jake (frontend) **Status:** request for review, nothing here is agreed yet

The food search / logging screens are finished and run on sample data and on-device storage.
They need a real backend before they can ship. This note says what the UI needs, what the
uploaded schema is missing, and what we need you to decide. **Everything marked "proposal" is a
starting point for discussion, not an agreed contract.** The frontend has not changed, and
will not change, any schema, migration, grant or RLS policy.

## What I checked, and where it came from

Source: `20261016202615_remote_schema.sql` (a dump of the `public` schema).

| Finding                                                          | Evidence in the file                                                                                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `foods` table and no `food_logs` table                        | Only `exercises`, `pantry_items`, `profiles`, `workout_exercises`, `workouts` are created                                                                                                       |
| No daily-targets table                                           | No table with targets; `api.ts` mentions a `targets.source` column, which does not exist in this dump                                                                                           |
| `authenticated` has no read/write privileges on any table        | The only grants to `authenticated` are `MAINTAIN, REFERENCES, TRIGGER, TRUNCATE` (e.g. line 256 for `pantry_items`); no `SELECT/INSERT/UPDATE/DELETE` grant to `authenticated` appears anywhere |
| Existing RLS pattern                                             | Per-user policies of the form `auth.uid() = user_id` on `pantry_items`, `workouts`; `profiles` keyed by `auth.users.id`                                                                         |
| User-owned tables reference `profiles(id)`, not `auth.users(id)` | FKs on `pantry_items.user_id` and `workouts.user_id`                                                                                                                                            |

I could not verify whether a trigger creates the `profiles` row at signup, because this dump
covers `public` only. If none exists, a new user cannot insert any row that references
`profiles` (see question 6).

## A. Food search: what the UI needs

Request (proposal):

- `query`: text, the UI sends nothing under 2 characters
- optional `limit` (UI currently shows up to 25)

Response, per food (proposal; these are the fields the screens read):

| Field      | Type                           | Notes                                                               |
| ---------- | ------------------------------ | ------------------------------------------------------------------- |
| `id`       | string                         | stable food id; the ML fixtures already use ids like `f_2041`       |
| `name`     | string                         | shown as the result title                                           |
| `brand`    | string or null                 |                                                                     |
| nutrients  | kcal, protein_g, carb_g, fat_g | **per 100 g** (see question 2)                                      |
| `servings` | list of `{ id, label, grams }` | e.g. `1 medium (118 g)` = 118 g; first is the default; at least one |

The UI also needs "get one food by id" (the detail screen), or search results that are complete
enough to reuse. An empty result must be an empty list, not an error.

## B. Food log: fields and nutrient representation

One row per logged food. The UI reads and writes these fields (proposal):

| Field                                  | Notes                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`                                   | the client generates one per attempt so retries are safe; server may replace it                              |
| `user_id`                              | **server-side only**, taken from the session. Never sent by the app                                          |
| `food_id`                              |                                                                                                              |
| `food_name`                            | snapshot, so the log can display without a join (needed if foods live in an external API with no FK)         |
| `date`                                 | `YYYY-MM-DD`, the user's **local** day the entry counts toward                                               |
| `logged_at`                            | ISO 8601 UTC timestamp                                                                                       |
| `serving_label`                        | e.g. `1 medium (118 g)`                                                                                      |
| `serving_quantity`                     | number of servings (decimals allowed, 0.1 to 100)                                                            |
| `grams`                                | total grams eaten = serving grams x quantity                                                                 |
| `kcal`, `protein_g`, `carb_g`, `fat_g` | nutrient snapshot for this entry, calculated by the client from the food's per-100 g values (rounded to 0.1) |

The PDF's list was: user id, food id, date, serving quantity, calculated nutrients. I have added
`id`, `food_name`, `logged_at`, `serving_label` and `grams` because the screens display them.
Please say which of these you want stored versus derived.

Operations needed: list entries for a date (oldest first), insert one (idempotent on `id`),
delete one.

## C. Daily totals

Today the app **sums the day's entries on the device**, so totals can never disagree with the
list above them. Options for you to choose between:

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

## E. Missing tables, grants and permissions for your review

- `foods` (or confirmation that search uses the external food API instead)
- `food_logs`
- Daily targets, if they will not come from ML `GET /today`
- `SELECT/INSERT/UPDATE/DELETE` privileges for `authenticated` on the tables the app uses. As
  written, the file grants none, so even with correct RLS policies the app is likely to get
  "permission denied". This also affects Mason's `pantry_items` and `workouts`. The default
  privilege revokes at the top of the file look like the cause, but that is your call.
- Whether a profile row is created automatically at signup

I have not written any SQL for these.

## F. Frontend files that will consume the final contract

| File                                                    | What changes                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/foods.ts`                                      | Swap `foodService` and `FOOD_DATA_SOURCE` to the real implementation. **This is the only switch.**                               |
| `src/api/foods.types.ts`                                | `FoodService` is the interface to implement: `searchFoods`, `getFood`, `listLogEntries`, `addLogEntry`, `removeLogEntry`         |
| `src/api/foods.mock.ts`                                 | Stays as the mock/test implementation, or is deleted                                                                             |
| `src/types/food.ts`                                     | Provisional types. Adapt the real response to them inside the new service, or change the types and `src/mocks/foods.ts` together |
| `src/hooks/useFoodSearch.ts`, `src/hooks/useFoodLog.ts` | Query keys, `retry: false`, and invalidation. Revisit retry once there is a real network                                         |
| `src/components/food/TodayNutrition.tsx`                | Where targets and totals are combined (see C)                                                                                    |
| `src/components/food/DataSourceNotice.tsx`              | The "Sample data" banner hides itself when `FOOD_DATA_SOURCE` is no longer `'mock'`                                              |
| `src/types/api.ts`                                      | Only if the ML contract changes (it is shared with the ML service and its fixtures)                                              |

Screens in `src/app/(modals)/` and the other components should not need to change.

## G. Questions we need to decide

1. **Search source.** The README says text search on a Supabase `foods` table; the MVP PDF says "the team's food info API". Which one?
2. **Nutrient basis.** Does the API return nutrients per 100 g, or per serving with a serving size and unit (as the PDF says)? The app stores grams internally and scales from per-100 g; a per-serving response needs a small adapter, and we need the serving size in grams.
3. **Servings.** Does each food come with its own list of servings (`1 cup = 158 g`), or only one serving size?
4. **Totals and targets** (section C): who computes them, and where do targets live?
5. **Log fields** (section B): which are stored, which are derived, and is `food_name` snapshotted?
6. **Profiles.** Is a `profiles` row created at signup? If not, inserts that reference it will fail for new users.
7. **Idempotency.** May the client supply the log entry `id`? Without it, a retried save can create a duplicate.
8. **Day boundary.** `date` is the user's local day, sent by the client. Is that acceptable, or should the server derive it from a timezone?
9. **Pagination.** Is the search result size capped, and does the API support paging?
10. **Errors.** What error shape should the app expect (the ML service uses `{ error: { code, message } }`)?
