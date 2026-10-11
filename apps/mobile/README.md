# FORM mobile app

Expo (SDK 57) + TypeScript, iOS only. Expo Router for navigation, TanStack Query for server
state, Supabase for auth and user rows, the ML service for anything derived.

## Install

Needs a current Node LTS and npm. For a simulator you need Xcode on a Mac; otherwise use Expo Go on an
iPhone, or an EAS cloud build.

```bash
cd apps/mobile
npm install
```

Versions in `package.json` are pinned exactly. Add packages with `npx expo install <pkg>`
(it picks the SDK-compatible version), then replace the `~`/`^` it writes with the exact
installed version.

## Environment

```bash
cp .env.example .env
```

| Variable                        | Purpose                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_USE_MOCKS`         | `1` (or unset): ML calls return `src/mocks` fixtures after 300 ms. `0`: call the real service. |
| `EXPO_PUBLIC_ML_URL`            | Base URL of `services/ml`. Used only when mocks are off.                                       |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase project URL. `supabase start` prints the local one.                                   |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Public by design; RLS protects the data.                                    |

With no `.env` at all, the app runs on mocks and needs no backend. `EXPO_PUBLIC_*` values are
baked into the bundle, so never put a secret in them. Restart `expo start` after editing `.env`.

## Run

```bash
npm start            # dev server; scan the QR code with Expo Go, or press i
npm run ios          # dev server + iOS simulator
npm run typecheck    # tsc --noEmit
npm run lint         # eslint, zero warnings allowed
npm run format       # prettier --write
npm test             # jest smoke test
```

## Layout

```
src/
  app/                    routes (Expo Router: every file is a screen)
    _layout.tsx           root stack + QueryClientProvider
    (tabs)/_layout.tsx    the five tabs, in order
    (tabs)/index.tsx      Today (default tab)
    (tabs)/pantry.tsx     Pantry
    (tabs)/cook.tsx       Cook
    (tabs)/train.tsx      Train
    (tabs)/profile.tsx    Profile
    (modals)/log-food.tsx example modal; add more modals beside it
  api/
    env.ts                every EXPO_PUBLIC_* read lives here
    ml.ts                 typed wrappers for the ML routes (mock or live)
    supabase.ts           the Supabase client, session persisted in AsyncStorage
  hooks/                  one TanStack Query hook per data source (useToday is the example)
  components/             primitives: Screen, Card, Row, Button, Pill, StatTile, NumberStepper
  mocks/                  one fixture per ML route (the stub responses)
  types/api.ts            request/response types for every ML route
  theme.ts                colors (light/dark), spacing, type scale, radii
```

## Conventions

- **Colors** come from `useTheme().colors`. ESLint rejects hex literals outside `src/theme.ts`.
- **Data**: screens never call `fetch` or `supabase` directly. Add a hook in `src/hooks/`
  that wraps `ml.*` or a Supabase query with `useQuery`/`useMutation`, following `useToday`.
  After a write (log food, cook, log a set), invalidate the queries it affects.
- **API shapes**: `src/types/api.ts` is the contract with the ML service. Change it, the
  fixture in `src/mocks/`, and the service's Pydantic model together, in the same PR.
- **Units and ids**: grams internally, convert only for display; UTC
  timestamps; never send a `user_id` to any endpoint.
- **Native modules**: Expo Go only ships Expo's bundled modules. Anything else needs a
  development build (`eas build --profile development`).

## Where each feature goes

Each screen file has `TODO(<screen>)` comments naming the data it needs.

| Feature                         | Where                                                                                              | Data                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Accounts, profile               | `src/app/(tabs)/profile.tsx`; sign-in screens as a new route group, gated in `src/app/_layout.tsx` | `supabase.auth`, `profiles`                              |
| Food search and logging         | `src/app/(modals)/log-food.tsx`                                                                    | `foods` text search, `food_logs`; `ml.predictMeal`       |
| Pantry                          | `src/app/(tabs)/pantry.tsx`                                                                        | `pantry_items`; barcode via server                       |
| Recipes, Cook Now               | `src/app/(tabs)/cook.tsx`                                                                          | `recipes`, `recipe_ingredients`, `log_cooked_recipe()`   |
| Gap closer                      | `src/app/(tabs)/index.tsx`                                                                         | `ml.gapCloser`                                           |
| Workout logging, next set, e1RM | `src/app/(tabs)/train.tsx`                                                                         | `exercises`, `workouts`, `workout_sets`; `ml.getNextSet` |
| Adaptive targets, weigh-in      | `src/app/(tabs)/index.tsx`                                                                         | `ml.getToday`, `body_metrics`                            |
| Readiness                       | check-in on Today, advice on Train                                                                 | `readiness_checkins`; `ml.getReadiness`                  |
| Weekly insights                 | `src/app/(tabs)/profile.tsx` (or a stack screen pushed from it)                                    | no ML route defined yet                                  |
| Stretch: receipt scanning       | `src/app/(tabs)/pantry.tsx`                                                                        | Supabase Storage upload; `ml.parseReceipt`               |
