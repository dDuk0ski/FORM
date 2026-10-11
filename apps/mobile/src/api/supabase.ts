import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from './env';

// The one Supabase client. Session is persisted in AsyncStorage and restored on launch.
// TODO(auth): sign up / sign in / sign out screens use this client.
// Queries for user rows (food_logs, pantry_items, workouts, ...) also go through it; the
// user's RLS policies scope every read and write. Never pass a user_id from the app.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Refresh the access token only while the app is in the foreground (Supabase's React Native
// guidance). Without this, a session restored after a long background can be expired.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
