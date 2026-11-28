import { pantryFixture } from '@/mocks';
import type { PantryItem, PantryItemInput, PantryService } from '@/types/pantry';

// mock pantry service. keeps data in memory for now, so it resets on app reload

let items: PantryItem[] = [...pantryFixture];

export const mockPantry: PantryService = {
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