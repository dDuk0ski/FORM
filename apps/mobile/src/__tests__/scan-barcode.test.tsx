import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { BarcodeNotAvailableError, barcodeService } from '@/api/barcode';
import { SAMPLE_UNKNOWN_BARCODE } from '@/api/barcode.mock';
import { foodService } from '@/api/foods';
import FoodDetailModal from '@/app/(modals)/food-detail';
import ScanBarcodeModal from '@/app/(modals)/scan-barcode';
import { localDateOf, nowUtcIso } from '@/lib/dates';
import { createWrapper } from '@/test-utils/providers';

/**
 * createWrapper plus gcTime Infinity for mutations (it already does this for queries), so a
 * finished mutation leaves no 5-minute garbage-collection timer keeping Jest alive.
 */
function createTestWrapper() {
  const result = createWrapper();
  result.queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  });
  return result;
}

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

// No real camera: a fake CameraView that records its props (see BarcodeScanner.test.tsx).
const mockCamera: { props: Record<string, unknown> | null } = { props: null };
jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function CameraView(props: Record<string, unknown>) {
    mockCamera.props = props;
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

const BANANA_CODE = '2000000000015';

async function setup() {
  const { wrapper } = createTestWrapper();
  await render(<ScanBarcodeModal />, { wrapper });
}

async function typeCode(code: string) {
  await fireEvent.changeText(screen.getByLabelText('Barcode number'), code);
  await fireEvent.press(screen.getByRole('button', { name: 'Look up barcode' }));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockCamera.props = null;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Scan barcode modal', () => {
  it('shows the barcode title and caption', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Scan barcode' })).toBeOnTheScreen();
    expect(screen.getByText('Fit the barcode inside the frame')).toBeOnTheScreen();
  });

  it('opens food detail with source barcode for a found typed code', async () => {
    await setup();
    await typeCode(BANANA_CODE);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/food-detail',
        params: { id: 'f_0455', source: 'barcode' },
      }),
    );
    expect(screen.getByText('Found Banana, raw. Opening…')).toBeOnTheScreen();
  });

  it('opens food detail for a camera scan, once, even if the camera repeats it', async () => {
    await setup();
    const onBarcodeScanned = mockCamera.props?.onBarcodeScanned as (r: {
      type: string;
      data: string;
    }) => void;
    await act(async () => {
      onBarcodeScanned({ type: 'ean13', data: BANANA_CODE });
      onBarcodeScanned({ type: 'ean13', data: BANANA_CODE });
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  });

  it('shows not found with Scan again and Search by name', async () => {
    await setup();
    await typeCode(SAMPLE_UNKNOWN_BARCODE);
    expect(await screen.findByText('We couldn’t find that product')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Search by name' }));
    expect(router.back).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Scan again' }));
    await waitFor(() => expect(screen.queryByText('We couldn’t find that product')).toBeNull());
  });

  it('shows an inline error for an invalid code and does not look it up', async () => {
    const lookup = jest.spyOn(barcodeService, 'lookupBarcode');
    await setup();
    await typeCode('12345');
    expect(screen.getByText('A barcode has 8, 12 or 13 digits.')).toBeOnTheScreen();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('shows the not-connected error and retries', async () => {
    const lookup = jest
      .spyOn(barcodeService, 'lookupBarcode')
      .mockRejectedValueOnce(new BarcodeNotAvailableError())
      .mockResolvedValueOnce(null);
    await setup();
    await typeCode(BANANA_CODE);
    expect(
      await screen.findByText('Barcode lookup is not connected to the server yet.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry barcode lookup' }));
    expect(await screen.findByText('We couldn’t find that product')).toBeOnTheScreen();
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenLastCalledWith(BANANA_CODE);
  });
});

describe('Food detail: log source', () => {
  async function addBanana(params: Record<string, string>) {
    jest.mocked(useLocalSearchParams).mockReturnValue(params as never);
    const { wrapper } = createTestWrapper();
    await render(<FoodDetailModal />, { wrapper });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add to log' }));
    expect(await screen.findByText('Added to your log')).toBeOnTheScreen();
    return foodService.listLogEntries(localDateOf(nowUtcIso()));
  }

  it('saves source barcode when opened from the scanner', async () => {
    const entries = await addBanana({ id: 'f_0455', source: 'barcode' });
    expect(entries.map((entry) => entry.source)).toEqual(['barcode']);
  });

  it('still saves source manual when opened from search', async () => {
    const entries = await addBanana({ id: 'f_0455' });
    expect(entries.map((entry) => entry.source)).toEqual(['manual']);
  });

  it('ignores an unknown source value', async () => {
    const entries = await addBanana({ id: 'f_0455', source: 'predicted' });
    expect(entries.map((entry) => entry.source)).toEqual(['manual']);
  });
});
