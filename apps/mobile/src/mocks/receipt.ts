import type { ReceiptResponse } from '@/types/api';

// Example payload for POST /receipt.
export const receiptFixture: ReceiptResponse = {
  items: [
    {
      raw_text: 'GRK YOG NF 32OZ',
      food_id: 'f_2041',
      name: 'Greek yogurt, plain, nonfat',
      grams: 907,
      confidence: 0.88,
    },
    {
      raw_text: 'BANANAS 2.1 LB',
      food_id: 'f_0455',
      name: 'Banana, raw',
      grams: 952,
      confidence: 0.74,
    },
  ],
  unmatched: ['CLUB CARD SAVINGS'],
  stub: true,
};
