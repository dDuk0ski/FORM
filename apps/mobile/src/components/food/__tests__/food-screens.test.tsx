import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import FoodDetailModal from '@/app/(modals)/food-detail';
import LogFoodModal from '@/app/(modals)/log-food';
import { createWrapper } from '@/test-utils/providers';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('Log food modal', () => {
  it('searches, then opens the food detail route for the tapped result', async () => {
    const { wrapper } = createWrapper();
    render(<LogFoodModal />, { wrapper });

    expect(screen.getByText('Sample data')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Search foods'), 'banana');
    fireEvent.press(await screen.findByRole('button', { name: /Banana, raw/ }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/food-detail',
      params: { id: 'f_0455' },
    });
  });

  it('shows today as empty before anything is logged, and closes', async () => {
    const { wrapper } = createWrapper();
    render(<LogFoodModal />, { wrapper });
    expect(await screen.findByText(/Nothing logged yet/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('Food detail modal', () => {
  it('shows the form for a known food', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'f_0455' } as never);
    const { wrapper } = createWrapper();
    render(<FoodDetailModal />, { wrapper });
    expect(await screen.findByRole('button', { name: 'Add to log' })).toBeOnTheScreen();
  });

  it('shows a not-found state for an unknown food', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'nope' } as never);
    const { wrapper } = createWrapper();
    render(<FoodDetailModal />, { wrapper });
    expect(await screen.findByText('Food not found')).toBeOnTheScreen();
  });

  it('goes back to search', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'nope' } as never);
    const { wrapper } = createWrapper();
    render(<FoodDetailModal />, { wrapper });
    fireEvent.press(await screen.findByRole('button', { name: 'Back to search' }));
    expect(router.back).toHaveBeenCalled();
  });
});
