import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Smoke test: the real app directory renders, lands on Today, and shows the daily brief
// built from the mocked GET /today numbers (EXPO_PUBLIC_USE_MOCKS is unset, so mocks are on).
it('renders the daily brief on Today with mocked data', async () => {
  renderRouter('src/app');

  expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
  expect(await screen.findByText('612 kcal · 48 g protein left')).toBeOnTheScreen();
  expect(screen.getByText('Dinner not logged yet')).toBeOnTheScreen();
  expect(screen.getByText('Use the chicken breast tomorrow')).toBeOnTheScreen();
});

it('opens the quick log options from the Log row', async () => {
  renderRouter('src/app');

  fireEvent.press(await screen.findByRole('button', { name: /^Log:/ }));
  expect(await screen.findByText('Weigh in')).toBeOnTheScreen();
  expect(screen.getByText('Check in for training')).toBeOnTheScreen();
});
