import { act, renderHook, waitFor } from '@testing-library/react-native';

import { BarcodeNotAvailableError, barcodeService } from '@/api/barcode';
import { SAMPLE_UNKNOWN_BARCODE } from '@/api/barcode.mock';
import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { foodDetailKey } from '@/hooks/useFoodSearch';
import { createWrapper } from '@/test-utils/providers';

async function setup() {
  const { queryClient, wrapper } = createWrapper();
  const hook = await renderHook(() => useBarcodeLookup(), { wrapper });
  return { queryClient, ...hook };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useBarcodeLookup', () => {
  it('resolves to the food for a known code and caches it for the detail screen', async () => {
    const { result, queryClient } = await setup();
    await act(async () => {
      result.current.mutate('2000000000015');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'f_0455', name: 'Banana, raw' });
    expect(queryClient.getQueryData(foodDetailKey('f_0455'))).toMatchObject({ id: 'f_0455' });
  });

  it('resolves to null when the code is not known', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.mutate(SAMPLE_UNKNOWN_BARCODE);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('reports a failure once, without retrying', async () => {
    const lookup = jest
      .spyOn(barcodeService, 'lookupBarcode')
      .mockRejectedValue(new BarcodeNotAvailableError());
    const { result } = await setup();
    await act(async () => {
      result.current.mutate('2000000000015');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(BarcodeNotAvailableError);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
