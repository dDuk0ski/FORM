import type { PantryItem, PantryService } from '@/types/pantry';

import { supabase } from './supabase';

// RLS only returns the signed-in user's rows, and user_id defaults to auth.uid()

const COLUMNS = 'id, user_id, name, quantity, unit, expiration_date, category, grams, food_id';

function friendlyError(error: { code?: string }): Error {
    if (error.code === '23514') return new Error('One of these values isn’t allowed. Check them and try again');
    if (error.code === '42501') return new Error('You don’t have permission to do this. Try logging in again');
    return new Error('Couldn’t reach your pantry. Check your connection and try again');
}

export const supabasePantry: PantryService = {
    // soonest to expire first, no date last
    async list() {
        const { data, error } = await supabase
            .from('pantry_items')
            .select(COLUMNS)
            .order('expiration_date', { ascending: true, nullsFirst: false })
            .order('name');
        if (error) throw friendlyError(error);
        return data as PantryItem[];
    },

    async add(input) {
        const { data, error } = await supabase.from('pantry_items').insert(input).select(COLUMNS).single();
        if (error) throw friendlyError(error);
        return data as PantryItem;
    },

    async update(id, patch) {
        const { data, error } = await supabase
            .from('pantry_items')
            .update(patch)
            .eq('id', id)
            .select(COLUMNS)
            .single();
        if (error) throw friendlyError(error);
        return data as PantryItem;
    },

    async remove(id) {
        const { error } = await supabase.from('pantry_items').delete().eq('id', id);
        if (error) throw friendlyError(error);
    },
};
