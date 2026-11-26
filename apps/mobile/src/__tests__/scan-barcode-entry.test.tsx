import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

// No real camera under Jest: a fake CameraView with the permission already granted.
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

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows Scan barcode on Log food and opens the scanner modal', async () => {
  await renderRouter('src/app');

  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  expect(await screen.findByRole('header', { name: 'Log food' })).toBeOnTheScreen();
  // The search field is still there, next to the new button.
  expect(screen.getByLabelText('Search foods')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));

  expect(await screen.findByRole('header', { name: 'Scan barcode' })).toBeOnTheScreen();
  expect(screen.getByText('Fit the barcode inside the frame')).toBeOnTheScreen();
  expect(screen.getByLabelText('Barcode number')).toBeOnTheScreen();
});
