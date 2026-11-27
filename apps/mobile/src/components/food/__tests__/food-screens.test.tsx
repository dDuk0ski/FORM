import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { foodService } from '@/api/foods';
import FoodDetailModal from '@/app/(modals)/food-detail';
import FoodSearchModal from '@/app/(modals)/food-search';
import LogFoodModal from '@/app/(modals)/log-food';
import { buildCustomGramsLog, buildServingLog, hydrateLogEntry } from '@/lib/nutrition';
import { foodsFixture } from '@/mocks/foods';
import { createWrapper } from '@/test-utils/providers';
import type { Food, MealType } from '@/types/food';

const banana = foodsFixture.find((food) => food.id === 'f_0455')!;
// Test-only food (not sample data) with unknown calories.
const mystery: Food = {
  id: 'f_test_unknown',
  name: 'Food with unknown values',
  brand: null,
  macros_per_100g: { kcal: null, protein_g: null, carb_g: 20, fat_g: 1 },
  servings: [{ id: '100g', label: '100 g', grams: 100 }],
};
const loggedAt = new Date().toISOString();
const bananaEntry = (id: string, meal: MealType) =>
  hydrateLogEntry(
    buildServingLog({
      id,
      food: banana,
      serving: banana.servings[0]!,
      quantity: 1,
      loggedAt,
      meal,
    }),
    banana,
  );
const mysteryEntry = (id: string, meal: MealType) =>
  hydrateLogEntry(buildCustomGramsLog({ id, food: mystery, grams: 100, loggedAt, meal }), mystery);

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Log food modal', () => {
  it('searches, then opens the food detail route for the tapped result', async () => {
    const { wrapper } = createWrapper();
    await render(<LogFoodModal />, { wrapper });

    expect(screen.getByText('Sample data')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'banana');
    await fireEvent.press(await screen.findByRole('button', { name: /Banana, raw/ }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/food-detail',
      params: { id: 'f_0455' },
    });
  });

  it('shows today as empty before anything is logged, and closes', async () => {
    const { wrapper } = createWrapper();
    await render(<LogFoodModal />, { wrapper });
    expect(await screen.findByText(/Nothing logged yet/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('Log food meal rows', () => {
  it('shows 0 kcal for each meal before anything is logged, and kcal left in the header', async () => {
    const { wrapper } = createWrapper();
    await render(<LogFoodModal />, { wrapper });
    expect(await screen.findByLabelText('Breakfast nothing logged')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lunch nothing logged')).toBeOnTheScreen();
    expect(screen.getByLabelText('Dinner nothing logged')).toBeOnTheScreen();
    // "Snacks" on this screen; the stored meal stays "snack".
    expect(screen.getByLabelText('Snacks nothing logged')).toBeOnTheScreen();
    expect(await screen.findByText(/^[\d,]+ kcal left$/)).toBeOnTheScreen();
  });

  it('totals kcal per meal, partial or unknown where entries are unknown', async () => {
    jest
      .spyOn(foodService, 'listLogEntries')
      .mockResolvedValue([
        bananaEntry('a', 'breakfast'),
        bananaEntry('b', 'breakfast'),
        bananaEntry('c', 'lunch'),
        mysteryEntry('d', 'lunch'),
        mysteryEntry('e', 'dinner'),
      ]);
    const { wrapper } = createWrapper();
    await render(<LogFoodModal />, { wrapper });

    expect(await screen.findByLabelText('Breakfast 210 calories')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Lunch at least 105 calories, some entries unknown'),
    ).toBeOnTheScreen();
    expect(screen.getByText('105 kcal+')).toBeOnTheScreen();
    expect(screen.getByLabelText('Dinner unknown')).toBeOnTheScreen();
    expect(screen.getByLabelText('Snacks nothing logged')).toBeOnTheScreen();
    // Some calories are unknown, so the header gives no "left" number.
    expect(await screen.findByText(/^315 kcal\+ eaten$/)).toBeOnTheScreen();
    expect(screen.queryByText(/kcal left/)).toBeNull();
  });

  it('opens food search with the meal preselected from its "+"', async () => {
    const { wrapper } = createWrapper();
    await render(<LogFoodModal />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add food to Dinner' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/food-search',
      params: { meal: 'dinner' },
    });
  });
});

describe('Food search modal', () => {
  it('opens food detail with the meal from the route', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ meal: 'snack' } as never);
    const { wrapper } = createWrapper();
    await render(<FoodSearchModal />, { wrapper });
    expect(screen.getByText(/^Snacks · /)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'banana');
    await fireEvent.press(await screen.findByRole('button', { name: /Banana, raw/ }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/food-detail',
      params: { id: 'f_0455', meal: 'snack' },
    });
  });

  it('passes the meal to the scanner too', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ meal: 'lunch' } as never);
    const { wrapper } = createWrapper();
    await render(<FoodSearchModal />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/scan-barcode',
      params: { meal: 'lunch' },
    });
  });
});

describe('Food detail modal', () => {
  it('shows the form for a known food', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'f_0455' } as never);
    const { wrapper } = createWrapper();
    await render(<FoodDetailModal />, { wrapper });
    expect(await screen.findByRole('button', { name: 'Add to log' })).toBeOnTheScreen();
  });

  it('shows a not-found state for an unknown food', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'nope' } as never);
    const { wrapper } = createWrapper();
    await render(<FoodDetailModal />, { wrapper });
    expect(await screen.findByText('Food not found')).toBeOnTheScreen();
  });

  it('goes back to search', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'nope' } as never);
    const { wrapper } = createWrapper();
    await render(<FoodDetailModal />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to search' }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('Food detail meal preselect', () => {
  it('selects the meal from the route, and it can still be changed', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'f_0455', meal: 'dinner' } as never);
    const { wrapper } = createWrapper();
    await render(<FoodDetailModal />, { wrapper });
    expect(await screen.findByRole('radio', { name: 'Dinner', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lunch' }));
    expect(screen.getByRole('radio', { name: 'Lunch', checked: true })).toBeOnTheScreen();
  });

  it('ignores a meal param that is not a meal', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'f_0455', meal: 'brunch' } as never);
    const { wrapper } = createWrapper();
    await render(<FoodDetailModal />, { wrapper });
    expect(await screen.findByRole('button', { name: 'Add to log' })).toBeOnTheScreen();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(2); // meal + serving
  });
});
