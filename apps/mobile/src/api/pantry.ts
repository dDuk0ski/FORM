import { pantryFixture } from '@/mocks';
import type { PantryItem, PantryItemInput } from '@/types/pantry';

// mock pantry service. keeps data in memory for now, so it resets on app reload
// TODO(Pantry): replace each function body with supabase calls
// the signatures stay the same so hooks and screens won't need to change

let items: PantryItem[] = [...pantryFixture];

export const pantry = {
    async list(): Promise<PantryItem[]> {
        return [...items];
    },

    async add(input: PantryItemInput): Promise<PantryItem> {
        const item: PantryItem = { ...input, id: `mock-${Date.now()}`, user_id: 'u1' }; // TEMPORARY: datetime as unique id
        items = [item, ...items];
        return item;
    },

    async update(id: string, patch: Partial<PantryItemInput>): Promise<PantryItem> {
        const current = items.find((i) => i.id === id);
        if (!current) throw new Error ('Pantry item not found');
        const updated = { ...current, ...patch };
        items = items.map((i) => (i.id === id ? updated : i));
        return updated;
    },

    async remove(id: string): Promise<void> {
        items = items.filter((i) => i.id !== id);
    }
};