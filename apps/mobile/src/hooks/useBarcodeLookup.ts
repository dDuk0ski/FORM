import { useMutation, useQueryClient } from '@tanstack/react-query';

import { barcodeService } from '@/api/barcode';
import { foodDetailKey } from '@/hooks/useFoodSearch';
import type { Food } from '@/types/food';

/**
 * Look up one barcode. A mutation, not a query: each scan or "Look up" tap is a one-off
 * action, and the screen shows its own loading / found / not found / error states. `data` is
 * null when the code is not known. No retry, so a failure shows "Try again" straight away.
 * A found food is put in the food-detail cache so the detail screen opens without a reload.
 */
export function useBarcodeLookup() {
  const queryClient = useQueryClient();
  return useMutation<Food | null, Error, string>({
    mutationFn: (code: string) => barcodeService.lookupBarcode(code),
    retry: false,
    onSuccess: (food) => {
      if (food) {
        queryClient.setQueryData(foodDetailKey(food.id), food);
      }
    },
  });
}
