import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// On main, Today's "Log food" button is the entry point to food logging. It opens the Log
// food modal with the search, the Nutrition card and the Logged today list. (The PR #5 Meal
// quick action test is deferred until that PR merges.)
it('opens Log food with the nutrition card and log from Today', async () => {
  await renderRouter('src/app');

  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));

  expect(await screen.findByRole('header', { name: 'Log food' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Search foods')).toBeOnTheScreen();
  expect(await screen.findByRole('header', { name: 'Logged today' })).toBeOnTheScreen();
  // Consumed is summed from logged entries, so it is 0 before anything is logged.
  expect(await screen.findByText(/^0 \/ \d+ kcal$/)).toBeOnTheScreen();
});
