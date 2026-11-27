import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { barcodeService } from '@/api/barcode';
import { createRealBarcodeService } from '@/api/barcode.real';
import { foodService } from '@/api/foods';
import FoodDetailModal from '@/app/(modals)/food-detail';
import ScanBarcodeModal from '@/app/(modals)/scan-barcode';
import { foodDetailKey } from '@/hooks/useFoodSearch';
import { createWrapper } from '@/test-utils/providers';

// The scan flow with the REAL-mode barcode service (fake fetch and fake session, no network):
// a found code ends on food detail with the server's food, from the cache, even when getFood
// cannot find that food. All values are FAKE samples, not any real product.

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function CameraView() {
    return React.createElement(View, { testID: 'camera-view' });
  }
  CameraView.isAvailableAsync = () => Promise.reject(new Error('web only'));
  return {
    CameraView,
    useCameraPermissions: () => [
      { granted: true, status: 'granted', canAskAgain: true },
      jest.fn(),
      jest.fn(),
    ],
  };
});

const UPCA = '200000000042';
const SERVER_FOOD_ID = 'server-food-uuid-1';
const BODY = {
  food: {
    id: SERVER_FOOD_ID,
    name: 'Sample granola bar',
    brand: 'Sample Brand',
    serving_g: 40,
    serving_label: '6 x 40 g',
    barcode: `0${UPCA}`,
    source: 'open_food_facts',
  },
  macros: {
    kcal_per_100g: '123',
    protein_g_per_100g: 10,
    carb_g_per_100g: 50,
    fat_g_per_100g: null,
  },
  cached: true,
};

function createTestWrapper() {
  const result = createWrapper();
  result.queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('ends on food detail with the scanned food and the meal preselected', async () => {
  const fetchFn = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(BODY),
  });
  const real = createRealBarcodeService({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-token' } },
        error: null,
      }),
    } as never,
    baseUrl: 'https://ml.example.test',
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  jest.spyOn(barcodeService, 'lookupBarcode').mockImplementation(real.lookupBarcode);
  // getFood cannot find the server's food (for example it is not readable yet).
  const getFood = jest.spyOn(foodService, 'getFood').mockResolvedValue(null);

  const { wrapper, queryClient } = createTestWrapper();
  jest.mocked(useLocalSearchParams).mockReturnValue({ meal: 'lunch' } as never);
  const scan = await render(<ScanBarcodeModal />, { wrapper });
  await fireEvent.changeText(screen.getByLabelText('Barcode number'), UPCA);
  await fireEvent.press(screen.getByRole('button', { name: 'Look up barcode' }));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/food-detail',
      params: { id: SERVER_FOOD_ID, source: 'barcode', meal: 'lunch' },
    }),
  );
  expect(fetchFn).toHaveBeenCalledWith(
    `https://ml.example.test/barcode/0${UPCA}`,
    expect.anything(),
  );
  // The food is in the detail cache before detail opens.
  expect(queryClient.getQueryData(foodDetailKey(SERVER_FOOD_ID))).toMatchObject({
    id: SERVER_FOOD_ID,
    name: 'Sample granola bar',
  });

  // Open food detail with the params the scanner navigated with, on the same cache.
  const params = jest.mocked(router.replace).mock.calls[0]![0] as { params: object };
  await scan.unmount();
  jest.mocked(useLocalSearchParams).mockReturnValue(params.params as never);
  await render(<FoodDetailModal />, { wrapper });

  expect(await screen.findByText('Sample granola bar')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: '1 serving (40 g)' })).toBeOnTheScreen();
  expect(screen.queryByRole('radio', { name: '6 x 40 g' })).toBeNull();
  expect(screen.getByRole('radio', { name: 'Lunch' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Add to log' })).toBeOnTheScreen();
  expect(getFood).not.toHaveBeenCalled();

  // A refetch that cannot find the food keeps the food on screen.
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: foodDetailKey(SERVER_FOOD_ID) });
  });
  expect(getFood).toHaveBeenCalledWith(SERVER_FOOD_ID);
  expect(screen.getByText('Sample granola bar')).toBeOnTheScreen();
  expect(screen.queryByText('Food not found')).toBeNull();

  // A refetch that fails keeps the form too.
  getFood.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: foodDetailKey(SERVER_FOOD_ID) });
  });
  expect(screen.getByText('Sample granola bar')).toBeOnTheScreen();
  expect(screen.queryByText("Couldn't load this food")).toBeNull();
});
