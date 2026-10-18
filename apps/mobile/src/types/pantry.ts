import type { IsoDate, PantryItemId } from './api';

export interface PantryItem {
    id: PantryItemId;
    user_id: string;
    name: string;
    quantity: number;
    unit: string;
    expiration_date: IsoDate | null;
    category: string | null;
}

// what the add/edit form produces: the database fills in everything except fields
export type PantryItemInput = Omit<PantryItem, 'id' | 'user_id'>;