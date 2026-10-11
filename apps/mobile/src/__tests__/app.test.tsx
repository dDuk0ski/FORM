import { renderRouter, screen } from 'expo-router/testing-library';

// Smoke test: the real app directory renders, lands on Today, and shows the mocked
// GET /today numbers (EXPO_PUBLIC_USE_MOCKS is unset, so mocks are on).
it('renders the Today tab with mocked data', async () => {
  renderRouter('src/app');

  expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
  expect(await screen.findByText('612 kcal')).toBeOnTheScreen();
  expect(screen.getByText('2068 kcal')).toBeOnTheScreen();
});
