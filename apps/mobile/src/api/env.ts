// Expo inlines EXPO_PUBLIC_* at build time, but only for literal `process.env.EXPO_PUBLIC_X`
// reads, so every variable is read here once. See .env.example.

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

export const env = {
  /** Mocks unless explicitly turned off, so the app runs with no backend. */
  useMocks: process.env.EXPO_PUBLIC_USE_MOCKS !== '0',
  mlUrl: (process.env.EXPO_PUBLIC_ML_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, ''),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL,
  // createClient throws on an empty key; a placeholder lets the app boot in mock mode.
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key',
};

if (__DEV__ && !env.useMocks && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. Supabase calls will fail until it is.');
}
