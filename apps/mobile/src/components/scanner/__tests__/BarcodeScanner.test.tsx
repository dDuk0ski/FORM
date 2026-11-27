import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Linking } from 'react-native';

import { BarcodeScanner } from '@/components/scanner';
import { createScanGuard, codeFromScan } from '@/components/scanner/scanGuard';
import { createWrapper } from '@/test-utils/providers';

// expo-camera has no native module under Jest, so it is replaced here (not in jest.setup.ts).
// The fake CameraView records its props so a test can "scan" by calling onBarcodeScanned.
type Permission = { granted: boolean; status: string; canAskAgain: boolean } | null;
const mockCamera: {
  permission: Permission;
  request: jest.Mock;
  available: jest.Mock;
  props: Record<string, unknown> | null;
} = { permission: null, request: jest.fn(), available: jest.fn(), props: null };

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function CameraView(props: Record<string, unknown>) {
    mockCamera.props = props;
    return React.createElement(View, { testID: 'camera-view' });
  }
  CameraView.isAvailableAsync = () => mockCamera.available();
  return {
    CameraView,
    useCameraPermissions: () => [mockCamera.permission, mockCamera.request, jest.fn()],
  };
});

const GRANTED = { granted: true, status: 'granted', canAskAgain: true };
const UNDETERMINED = { granted: false, status: 'undetermined', canAskAgain: true };
const DENIED = { granted: false, status: 'denied', canAskAgain: false };

const EAN13 = '2000000000015';
const OTHER = '2000000000022';

async function scan(data: string, type = 'ean13') {
  const onBarcodeScanned = mockCamera.props?.onBarcodeScanned as
    ((result: { type: string; data: string }) => void) | undefined;
  await act(async () => {
    onBarcodeScanned?.({ type, data });
  });
}

async function setup(props: Partial<Parameters<typeof BarcodeScanner>[0]> = {}) {
  const onScanned = jest.fn();
  const onError = jest.fn();
  const onBack = jest.fn();
  const { wrapper } = createWrapper();
  const view = await render(
    <BarcodeScanner onScanned={onScanned} onError={onError} onBack={onBack} {...props} />,
    { wrapper },
  );
  return { onScanned, onError, onBack, ...view };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCamera.permission = GRANTED;
  mockCamera.props = null;
  // Native: isAvailableAsync is web-only and throws; the scanner then trusts the device.
  mockCamera.available.mockRejectedValue(new Error('web only'));
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BarcodeScanner: design text', () => {
  it('shows the title, the caption and the typed-entry label', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Scan barcode' })).toBeOnTheScreen();
    expect(screen.getByText('Fit the barcode inside the frame')).toBeOnTheScreen();
    expect(screen.getByText('Or type the barcode')).toBeOnTheScreen();
    expect(screen.queryByText(/receipt/i)).toBeNull();
  });

  it('goes back from the back arrow', async () => {
    const { onBack } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('BarcodeScanner: permission states', () => {
  it('waits while the permission is unknown', async () => {
    mockCamera.permission = null;
    await setup();
    expect(screen.getByText('Asking for camera access…')).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('asks for the camera when it has not been asked yet', async () => {
    mockCamera.permission = UNDETERMINED;
    mockCamera.request.mockResolvedValue(GRANTED);
    await setup();
    expect(screen.queryByTestId('camera-view')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow camera' }));
    expect(mockCamera.request).toHaveBeenCalledTimes(1);
  });

  it('explains a denied permission and opens Settings', async () => {
    mockCamera.permission = DENIED;
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await setup();
    expect(screen.getByText('Camera access is off')).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    // Typed entry still works without the camera.
    expect(screen.getByLabelText('Barcode number')).toBeOnTheScreen();
  });

  it('shows the live camera with the retail barcode types when granted', async () => {
    await setup();
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
    expect(mockCamera.props?.barcodeScannerSettings).toEqual({
      barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
    });
    expect(screen.getByTestId('scan-line-static', { includeHiddenElements: true })).toBeTruthy();
  });

  it('falls back to typed entry when there is no camera', async () => {
    mockCamera.available.mockResolvedValue(false);
    await setup();
    expect(await screen.findByText('No camera available')).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).toBeNull();
    expect(screen.getByLabelText('Barcode number')).toBeOnTheScreen();
  });

  it('reports a camera that fails to start and shows the fallback', async () => {
    const { onError } = await setup();
    const onMountError = mockCamera.props?.onMountError as (e: { message: string }) => void;
    await act(async () => {
      onMountError({ message: 'Camera not available on simulator' });
    });
    expect(onError).toHaveBeenCalledWith(new Error('Camera not available on simulator'));
    expect(screen.getByText('No camera available')).toBeOnTheScreen();
  });
});

describe('BarcodeScanner: scanning', () => {
  it('fires once for a burst of scans, ignoring repeats and other codes', async () => {
    const { onScanned } = await setup();
    await scan(EAN13);
    await scan(EAN13);
    await scan(OTHER);
    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith(EAN13);
  });

  it('ignores misreads (bad check digit) and expands UPC-E', async () => {
    const { onScanned } = await setup();
    await scan('2000000000016');
    expect(onScanned).not.toHaveBeenCalled();
    await scan('01234565', 'upc_e');
    expect(onScanned).toHaveBeenCalledWith('012345000065');
  });

  it('stops scanning while inactive and allows a new scan once active again', async () => {
    const { onScanned, rerender } = await setup();
    await scan(EAN13);
    await rerender(<BarcodeScanner onScanned={onScanned} onBack={jest.fn()} active={false} />);
    expect(mockCamera.props?.onBarcodeScanned).toBeUndefined();
    await rerender(<BarcodeScanner onScanned={onScanned} onBack={jest.fn()} active />);
    await scan(OTHER);
    expect(onScanned).toHaveBeenNthCalledWith(2, OTHER);
  });

  it('animates the scan line unless reduce motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { unmount } = await setup();
    expect(
      await screen.findByTestId('scan-line-animated', { includeHiddenElements: true }),
    ).toBeTruthy();
    await unmount();
  });
});

describe('BarcodeScanner: typed entry', () => {
  it('shows inline errors for empty, letters, wrong length and a bad check digit', async () => {
    const { onScanned } = await setup();
    const field = screen.getByLabelText('Barcode number');
    const lookUp = screen.getByRole('button', { name: 'Look up barcode' });

    await fireEvent.press(lookUp);
    expect(screen.getByText('Enter a barcode.')).toBeOnTheScreen();

    await fireEvent.changeText(field, 'abc');
    await fireEvent.press(lookUp);
    expect(screen.getByText('Use digits only.')).toBeOnTheScreen();

    await fireEvent.changeText(field, '12345');
    await fireEvent.press(lookUp);
    expect(screen.getByText('A barcode has 8, 12 or 13 digits.')).toBeOnTheScreen();

    await fireEvent.changeText(field, '2000000000016');
    await fireEvent.press(lookUp);
    expect(screen.getByText(/That barcode isn’t valid/)).toBeOnTheScreen();

    expect(onScanned).not.toHaveBeenCalled();
  });

  it('submits a valid typed code, normalized', async () => {
    const { onScanned } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Barcode number'), ' 2000 0000 0001 5 ');
    await fireEvent.press(screen.getByRole('button', { name: 'Look up barcode' }));
    expect(onScanned).toHaveBeenCalledWith(EAN13);
  });

  it('disables Look up while inactive', async () => {
    const { onScanned } = await setup({ active: false });
    await fireEvent.changeText(screen.getByLabelText('Barcode number'), EAN13);
    await fireEvent.press(screen.getByRole('button', { name: 'Look up barcode' }));
    expect(onScanned).not.toHaveBeenCalled();
  });
});

describe('scan guard', () => {
  it('lets one code through, then ignores the same code for 2 seconds after release', () => {
    let now = 0;
    const guard = createScanGuard(() => now);
    expect(guard.accept(EAN13)).toBe(true);
    expect(guard.accept(EAN13)).toBe(false);
    expect(guard.accept(OTHER)).toBe(false);
    guard.release();
    now = 1999;
    expect(guard.accept(EAN13)).toBe(false);
    now = 2000;
    expect(guard.accept(EAN13)).toBe(true);
  });

  it('allows a different code right after release', () => {
    const guard = createScanGuard(() => 0);
    expect(guard.accept(EAN13)).toBe(true);
    guard.release();
    expect(guard.accept(OTHER)).toBe(true);
  });

  it('maps camera results to codes', () => {
    expect(codeFromScan('ean13', EAN13)).toBe(EAN13);
    expect(codeFromScan('ean13', 'not a code')).toBeNull();
    expect(codeFromScan('upc_e', '01234565')).toBe('012345000065');
  });
});
