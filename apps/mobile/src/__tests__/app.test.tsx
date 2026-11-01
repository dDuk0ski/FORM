import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Smoke test: the real app directory renders, lands on Today, and shows the daily brief
// built from the mocked GET /today numbers (EXPO_PUBLIC_USE_MOCKS is unset, so mocks are on).
it('renders the daily brief on Today with mocked data', async () => {
  renderRouter('src/app');

  expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
  expect(await screen.findByText('612')).toBeOnTheScreen();
  expect(screen.getByText('Dinner next')).toBeOnTheScreen();
  expect(screen.getByText('Chicken breast tomorrow')).toBeOnTheScreen();
});

it('opens the weigh-in sheet from the quick actions', async () => {
  renderRouter('src/app');

  fireEvent.press(await screen.findByRole('button', { name: 'Weigh in' }));
  expect(await screen.findByText('Weight')).toBeOnTheScreen();
});
