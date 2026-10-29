import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';

import { foodService } from '@/api/foods';
import { DailyNutritionCard } from '@/components/food/DailyNutritionCard';
import { FoodLogForm } from '@/components/food/FoodLogForm';
import { FoodLogList } from '@/components/food/FoodLogList';
import { SearchResults } from '@/components/food/SearchResults';
import { TodayNutrition } from '@/components/food/TodayNutrition';
import { todayLocal } from '@/lib/dates';
import { buildCustomGramsLog, buildServingLog, hydrateLogEntry } from '@/lib/nutrition';
import { foodsFixture } from '@/mocks/foods';
import { createWrapper } from '@/test-utils/providers';

const banana = foodsFixture.find((food) => food.id === 'f_0455')!;

function renderWithProviders(ui: ReactElement) {
  const { wrapper, queryClient } = createWrapper();
  return { queryClient, ...render(ui, { wrapper }) };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SearchResults', () => {
  it('shows a hint until the query is long enough', () => {
    renderWithProviders(<SearchResults query="b" onSelect={jest.fn()} />);
    expect(screen.getByText('Search for a food')).toBeOnTheScreen();
  });

  it('lists matches with calories for the default serving, and opens one on press', async () => {
    const onSelect = jest.fn();
    renderWithProviders(<SearchResults query="banana" onSelect={onSelect} />);
    expect(await screen.findByText('Banana, raw')).toBeOnTheScreen();
    expect(screen.getByText('105 kcal')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: /Banana, raw/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'f_0455' }));
  });

  it('says so when nothing matches', async () => {
    renderWithProviders(<SearchResults query="zzzz" onSelect={jest.fn()} />);
    expect(await screen.findByText('No foods found')).toBeOnTheScreen();
  });

  it('shows the error and recovers on retry', async () => {
    jest.spyOn(foodService, 'searchFoods').mockRejectedValueOnce(new Error('Network down'));
    renderWithProviders(<SearchResults query="banana" onSelect={jest.fn()} />);
    expect(await screen.findByText('Search failed')).toBeOnTheScreen();
    expect(screen.getByText('Network down')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Banana, raw')).toBeOnTheScreen();
  });
});

describe('FoodLogForm', () => {
  it('previews nutrition for the default serving', () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    expect(screen.getByText('105 kcal')).toBeOnTheScreen();
    expect(screen.getByText('118 g in total')).toBeOnTheScreen();
  });

  it('rescales the preview when the amount or serving changes', () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.changeText(screen.getByLabelText('Servings'), '1.5');
    expect(screen.getByText('158 kcal')).toBeOnTheScreen(); // 177 g x 0.89
    expect(screen.getByText('177 g in total')).toBeOnTheScreen();
  });

  it('offers custom grams, starting at 100 g, and scales from the grams typed', () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Custom grams' }));
    expect(screen.getByLabelText('Grams').props.value).toBe('100');
    expect(screen.getByText('89 kcal')).toBeOnTheScreen();
    expect(screen.getByText('100 g in total')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Grams'), '150');
    expect(screen.getByText('134 kcal')).toBeOnTheScreen(); // 150 g x 0.89 = 133.5

    fireEvent.press(screen.getByRole('button', { name: 'Increase Grams' }));
    expect(screen.getByLabelText('Grams').props.value).toBe('160');

    fireEvent.changeText(screen.getByLabelText('Grams'), '0');
    expect(screen.getByRole('button', { name: 'Add to log' })).toBeDisabled();
  });

  it('goes back to servings, starting at 1 serving', () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Custom grams' }));
    fireEvent.press(screen.getByRole('radio', { name: '1 medium (118 g)' }));
    expect(screen.getByLabelText('Servings').props.value).toBe('1');
    expect(screen.getByText('105 kcal')).toBeOnTheScreen();
  });

  it('suggests a meal and lets the person change it', () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    expect(screen.getByRole('radio', { name: 'Dinner', checked: true })).toBeOnTheScreen();
  });

  it('saves the chosen meal and custom grams, with no serving', async () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Custom grams' }));
    fireEvent.changeText(screen.getByLabelText('Grams'), '150');
    fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));
    expect(await screen.findByText('Added to your log')).toBeOnTheScreen();
    const [saved] = await foodService.listLogEntries(todayLocal());
    expect(saved).toMatchObject({
      meal: 'dinner',
      source: 'manual',
      grams: 150,
      serving_label: null,
      serving_quantity: null,
    });
  });

  it('steps the amount with the plus and minus buttons', () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.press(screen.getByRole('button', { name: 'Increase Servings' }));
    expect(screen.getByLabelText('Servings').props.value).toBe('1.5');
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Servings' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Servings' }));
    expect(screen.getByLabelText('Servings').props.value).toBe('0.5');
  });

  it('blocks adding when the amount is invalid, with a message', () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.changeText(screen.getByLabelText('Servings'), 'abc');
    expect(screen.getByText('Use numbers only, like 1 or 1.5.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add to log' })).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText('Servings'), '');
    expect(screen.getByText('Enter an amount.')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Servings'), '0');
    expect(screen.getByRole('button', { name: 'Add to log' })).toBeDisabled();
  });

  it('adds the food to the log and confirms', async () => {
    renderWithProviders(
      <View>
        <FoodLogForm food={banana} />
        <TodayNutrition />
      </View>,
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Add to log' }));
    expect(await screen.findByText('Added to your log')).toBeOnTheScreen();
    // The entry now shows in today's log...
    expect(await screen.findByLabelText('Remove Banana, raw')).toBeOnTheScreen();
    // ...and in storage.
    await expect(foodService.listLogEntries(todayLocal())).resolves.toHaveLength(1);
  });

  it('keeps the form and offers a retry when saving fails', async () => {
    jest.spyOn(foodService, 'addLogEntry').mockRejectedValueOnce(new Error('Storage is full'));
    renderWithProviders(<FoodLogForm food={banana} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add to log' }));
    expect(await screen.findByText(/Storage is full/)).toBeOnTheScreen();
    expect(screen.queryByText('Added to your log')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Added to your log')).toBeOnTheScreen();
  });

  it('saves one entry even if the button is pressed repeatedly', async () => {
    renderWithProviders(<FoodLogForm food={banana} />);
    const button = screen.getByRole('button', { name: 'Add to log' });
    fireEvent.press(button);
    fireEvent.press(button);
    fireEvent.press(button);
    await screen.findByText('Added to your log');
    await waitFor(async () =>
      expect(await foodService.listLogEntries(todayLocal())).toHaveLength(1),
    );
  });
});

describe('DailyNutritionCard', () => {
  const totals = { kcal: 105, protein_g: 1.3, carb_g: 26.9, fat_g: 0.4 };
  const targets = { kcal: 2680, protein_g: 175, carb_g: 300, fat_g: 85 };

  it('shows progress toward targets when they are known', () => {
    renderWithProviders(<DailyNutritionCard totals={totals} targets={targets} />);
    expect(screen.getByText('105 / 2680 kcal')).toBeOnTheScreen();
    expect(screen.getByText('1.3 / 175 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories progress').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 4,
    });
  });

  it('shows totals only, with no progress bars, when there are no targets', () => {
    renderWithProviders(<DailyNutritionCard totals={totals} />);
    expect(screen.getByText('105 kcal')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Calories progress')).toBeNull();
  });

  it('caps the bar at 100% when a target is exceeded', () => {
    renderWithProviders(
      <DailyNutritionCard totals={{ ...totals, kcal: 3000 }} targets={targets} />,
    );
    expect(screen.getByLabelText('Calories progress').props.accessibilityValue.now).toBe(100);
  });
});

describe('FoodLogList', () => {
  const entry = hydrateLogEntry(
    buildServingLog({
      id: 'le_1',
      food: banana,
      serving: banana.servings[0]!,
      quantity: 1.5,
      loggedAt: '2026-10-16T12:00:00.000Z',
      meal: 'breakfast',
    }),
    banana,
  );

  it('invites the first entry when empty', () => {
    renderWithProviders(<FoodLogList entries={[]} />);
    expect(screen.getByText(/Nothing logged yet/)).toBeOnTheScreen();
  });

  it('shows each entry with its serving and quantity, and removes on press', () => {
    const onRemove = jest.fn();
    renderWithProviders(<FoodLogList entries={[entry]} onRemove={onRemove} />);
    expect(screen.getByText('Banana, raw')).toBeOnTheScreen();
    expect(screen.getByText('1.5 × 1 medium (118 g)')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Remove Banana, raw' }));
    expect(onRemove).toHaveBeenCalledWith('le_1');
  });

  it('shows grams for an entry logged as custom grams', () => {
    const custom = hydrateLogEntry(
      buildCustomGramsLog({
        id: 'le_2',
        food: banana,
        grams: 150,
        loggedAt: '2026-10-16T12:00:00.000Z',
        meal: 'snack',
      }),
      banana,
    );
    renderWithProviders(<FoodLogList entries={[custom]} />);
    expect(screen.getByText('150 g')).toBeOnTheScreen();
  });
});
