import type { PantryItem } from '@/types/pantry';

// placeholder rows for the pantry_items table
export const pantryFixture: PantryItem[] = [
    { id: 'p1', user_id: 'u1', name: 'Chicken breast', quantity: 500, unit: 'g', expiration_date: '2026-10-19', category: 'meat' },
    { id: 'p2', user_id: 'u1', name: 'Oats', quantity: 200, unit: 'g', expiration_date: '2027-03-01', category: 'grains' },
    { id: 'p3', user_id: 'u1', name: 'Greek yogurt', quantity: 1000, unit: 'g', expiration_date: '2026-10-14', category: 'dairy' },
    { id: 'p4', user_id: 'u1', name: 'Olive oil', quantity: 450, unit: 'ml', expiration_date: null, category: 'pantry' },
    { id: 'p5', user_id: 'u1', name: 'Ground turkey', quantity: 700, unit: 'g', expiration_date: '2026-10-20', category: 'meat' },
];