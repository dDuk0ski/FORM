import { fireEvent, render, screen } from '@testing-library/react-native';

import { Text } from 'react-native';

import { colors, radii } from '@/theme';

import { Button } from '../Button';
import { Card } from '../Card';
import { ProgressBar } from '../ProgressBar';
import { SearchInput } from '../SearchInput';
import { EmptyState, ErrorState, LoadingState } from '../StateViews';

// The additive tokens and variants used by the food screens. Defaults must stay as on main.

describe('theme tokens', () => {
  it('adds the Figma tokens to both schemes and keeps the originals', () => {
    for (const scheme of [colors.light, colors.dark]) {
      expect(scheme.primary).toBeDefined();
      expect(scheme.primarySoft).toBeDefined();
      expect(scheme.progressOver).toBeDefined();
      expect(scheme.macroProtein).toBeDefined();
    }
    expect(colors.light.primarySoft).not.toBe(colors.light.primary);
    expect(radii.lg).toBe(16);
    expect(radii.xlSoft).toBe(24);
    expect(radii.sheet).toBe(32);
  });
});

describe('Button', () => {
  it('keeps the primary default and adds the soft pill variants', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button title="Default" onPress={onPress} />
        <Button title="Soft" variant="soft" onPress={onPress} />
        <Button title="Outline" variant="softOutline" onPress={onPress} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Default' })).toHaveStyle({
      backgroundColor: colors.light.primary,
      borderRadius: radii.md,
    });
    expect(screen.getByRole('button', { name: 'Soft' })).toHaveStyle({
      backgroundColor: colors.light.primarySoft,
      borderRadius: radii.pill,
    });
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveStyle({
      borderColor: colors.light.chipBorder,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Soft' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Card', () => {
  it('uses the main radius by default and xlSoft for the soft variant', async () => {
    await render(
      <>
        <Card>
          <Text>Plain card</Text>
        </Card>
        <Card variant="soft">
          <Text>Soft card</Text>
        </Card>
      </>,
    );
    expect(screen.getByText('Plain card').parent).toHaveStyle({
      borderRadius: radii.lg,
      borderColor: colors.light.border,
    });
    expect(screen.getByText('Soft card').parent).toHaveStyle({
      borderRadius: radii.xlSoft,
      borderColor: colors.light.cardBorder,
    });
  });
});

describe('ProgressBar', () => {
  it('clamps the fraction and switches to the over color past 1', async () => {
    await render(
      <>
        <ProgressBar fraction={0.5} accessibilityLabel="Half" />
        <ProgressBar fraction={1.4} tone="protein" accessibilityLabel="Over" />
        <ProgressBar fraction={Number.NaN} tone="fat" accessibilityLabel="Unknown" />
      </>,
    );
    expect(screen.getByLabelText('Half')).toHaveAccessibilityValue({ now: 50 });
    expect(screen.getByLabelText('Over')).toHaveAccessibilityValue({ now: 100 });
    expect(screen.getByLabelText('Unknown')).toHaveAccessibilityValue({ now: 0 });
  });
});

describe('SearchInput and state views', () => {
  it('reports typed text and renders loading, empty and error states', async () => {
    const onChangeText = jest.fn();
    const onRetry = jest.fn();
    await render(
      <>
        <SearchInput
          value=""
          onChangeText={onChangeText}
          accessibilityLabel="Find"
          variant="soft"
        />
        <LoadingState />
        <EmptyState title="Nothing here" message="Try another word" />
        <ErrorState message="Check your connection" onRetry={onRetry} />
      </>,
    );
    await fireEvent.changeText(screen.getByLabelText('Find'), 'oat');
    expect(onChangeText).toHaveBeenCalledWith('oat');
    expect(screen.getByText('Loading…')).toBeOnTheScreen();
    expect(screen.getByText('Nothing here')).toBeOnTheScreen();
    expect(screen.getByText('Check your connection')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
