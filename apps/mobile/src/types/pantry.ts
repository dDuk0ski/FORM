import type { IsoDate, PantryItemId } from './api';

export interface PantryItem {
    id: PantryItemId;
    user_id: string;
    name: string;
    quantity: number;
    unit: string;
    expiration_date: IsoDate | null;
    category: string | null;
    // optional until the form switches to grams
    grams?: number | null;
    food_id?: string | null;
}

// what the add/edit form produces: the database fills in everything except fields
export type PantryItemInput = Omit<PantryItem, 'id' | 'user_id'>;

export type PantryService = {
    list(): Promise<PantryItem[]>;
    add(input: PantryItemInput): Promise<PantryItem>;
    update(id: string, patch: Partial<PantryItemInput>): Promise<PantryItem>;
    remove(id: string): Promise<void>;
};