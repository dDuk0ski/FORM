import { render, renderHook, screen, waitFor } from '@testing-library/react-native';

import { DaySummaryCard } from '@/components';
import { daySummaryInput, useDaySummary } from '@/hooks/useDaySummary';
import { todayFixture } from '@/mocks/today';
import { createWrapper } from '@/test-utils/providers';

const native = {
  availability: jest.fn(),
  summarizeDay: jest.fn(),
};
let mockModule: typeof native | null = native;
jest.mock('../../../modules/form-assistant', () => ({
  __esModule: true,
  get default() {
    return mockModule;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockModule = native;
});

it('builds the prompt input from GET /today', () => {
  expect(daySummaryInput(todayFixture, true)).toEqual({
    date: todayFixture.date,
    targets: todayFixture.targets,
    consumed: todayFixture.consumed,
    remaining: todayFixture.remaining,
    rationale: todayFixture.rationale,
    workout_done: true,
    readiness_score: 71,
  });
  expect(daySummaryInput(todayFixture).workout_done).toBeNull();
});

it('summarizes the day when the assistant is available', async () => {
  native.availability.mockReturnValue('available');
  native.summarizeDay.mockResolvedValue('612 kcal and 48 g protein to go.');
  const { result } = await renderHook(() => useDaySummary(todayFixture), {
    wrapper: createWrapper().wrapper,
  });
  await waitFor(() => expect(result.current.data).toBe('612 kcal and 48 g protein to go.'));
});

it.each([
  ['unsupported', null],
  ['appleIntelligenceNotEnabled', native],
] as const)('stays idle when %s', async (_label, module) => {
  mockModule = module;
  native.availability.mockReturnValue('appleIntelligenceNotEnabled');
  const { result } = await renderHook(() => useDaySummary(todayFixture), {
    wrapper: createWrapper().wrapper,
  });
  expect(result.current.fetchStatus).toBe('idle');
  expect(result.current.data).toBeUndefined();
  expect(native.summarizeDay).not.toHaveBeenCalled();
});

it('the card renders the summary and hides without one', async () => {
  const { rerender } = await render(<DaySummaryCard summary="Nice work today." />, {
    wrapper: createWrapper().wrapper,
  });
  expect(screen.getByText('Nice work today.')).toBeOnTheScreen();
  await rerender(<DaySummaryCard summary={null} />);
  expect(screen.queryByText('Your day so far')).toBeNull();
});
