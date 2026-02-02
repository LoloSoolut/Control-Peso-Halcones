
import { Hawk, DailyEntry, FoodEntry } from '../types';
import { supabase } from './supabase';

export const getHawks = async (userId: string): Promise<Hawk[]> => {
  try {
    const { data: hawks, error } = await supabase
      .from('hawks')
      .select(`
        *,
        entries:entries (
          *,
          food_items:food_items (*)
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    return (hawks || []).map((h: any) => ({
      ...h,
      targetWeight: h.target_weight || h.targetWeight,
      entries: (h.entries || []).map((e: any) => ({
        ...e,
        weightBefore: e.weight_before || e.weightBefore,
        weightAfter: e.weight_after || e.weightAfter,
        foodItems: e.food_items || e.foodItems || []
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }));
  } catch (err) {
    console.error('Error en getHawks:', err);
    return [];
  }
};

export const createHawk = async (name: string, species: string, targetWeight: number, userId: string): Promise<Hawk | null> => {
  try {
    const { data, error } = await supabase
      .from('hawks')
      .insert([{ 
        name, 
        species, 
        target_weight: targetWeight, 
        user_id: userId 
      }])
      .select()
      .single();

    if (error) throw error;
    return { ...data, targetWeight: data.target_weight || targetWeight, entries: [] };
  } catch (err) {
    console.error('Error en createHawk:', err);
    return null;
  }
};

export const deleteHawk = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from('hawks').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Error al eliminar halcón:', err);
  }
};

export const saveEntry = async (hawkId: string, weightBefore: number, weightAfter: number, foodItems: any[]): Promise<boolean> => {
  try {
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert([{
        hawk_id: hawkId,
        weight_before: weightBefore,
        weight_after: weightAfter,
        date: new Date().toISOString()
      }])
      .select()
      .single();

    if (entryError) throw entryError;

    if (foodItems.length > 0) {
      const itemsToInsert = foodItems.map(item => ({
        entry_id: entry.id,
        type: item.type,
        portion: item.portion,
        quantity: item.quantity
      }));

      const { error: foodError } = await supabase
        .from('food_items')
        .insert(itemsToInsert);

      if (foodError) throw foodError;
    }

    return true;
  } catch (err) {
    console.error('Error al guardar registro:', err);
    return false;
  }
};
