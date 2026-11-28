import { renderRouter, screen } from 'expo-router/testing-library';

import { auth } from '@/api/auth';
import { onboarding } from '@/api/onboarding';

// The root layout only shows the tabs to a signed-in, onboarded user, so start as one.
beforeEach(() => {
  jest.spyOn(auth, 'getSession').mockResolvedValue({ user: { id: 'u1', email: 'test@example.com' } });
  jest.spyOn(onboarding, 'isComplete').mockResolvedValue(true);
});

// Smoke test: the real app directory renders, lands on Today, and shows the mocked
// GET /today numbers (EXPO_PUBLIC_USE_MOCKS is unset, so mocks are on).
it('renders the Today tab with mocked data', async () => {
  await renderRouter('src/app');

  // findBy waits: the root layout renders nothing until the session check resolves.
  expect(await screen.findByRole('header', { name: 'Today' })).toBeOnTheScreen();
  expect(await screen.findByText('612 kcal')).toBeOnTheScreen();
  expect(screen.getByText('2068 kcal')).toBeOnTheScreen();
});
