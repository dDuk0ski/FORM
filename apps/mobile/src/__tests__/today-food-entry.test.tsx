import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Today's Meal quick action is the entry point to food logging: it opens the Log food modal,
// which holds the search, the Nutrition card and the Logged today list.
it('opens Log food with the nutrition card and log from the Meal quick action', async () => {
  renderRouter('src/app');

  fireEvent.press(await screen.findByRole('button', { name: 'Meal' }));

  expect(await screen.findByRole('header', { name: 'Log food' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Search foods')).toBeOnTheScreen();
  expect(await screen.findByRole('header', { name: 'Logged today' })).toBeOnTheScreen();
  // The kcal target from the mocked GET /today (2680) reaches the Nutrition card; consumed is
  // summed from logged entries, so it is 0 before anything is logged.
  expect(await screen.findByText('0 / 2680 kcal')).toBeOnTheScreen();
});
