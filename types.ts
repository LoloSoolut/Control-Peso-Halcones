export type FoodCategory = 'Paloma' | 'Codorniz' | 'Pollito' | 'Pato' | 'Perdiz';
export type FoodPortion = 'Entera' | 'Pecho' | 'Pata' | 'Con Vitelo' | 'Sin Vitelo';

export const FOOD_WEIGHT_MAP: Record<FoodCategory, Partial<Record<FoodPortion, number>>> = {
  'Pollito': { 'Con Vitelo': 25, 'Sin Vitelo': 20 },
  'Paloma': { 'Pecho': 45, 'Pata': 20, 'Entera': 100 },
  'Perdiz': { 'Pecho': 60, 'Pata': 35, 'Entera': 150 },
  'Pato': { 'Pecho': 100, 'Pata': 50, 'Entera': 300 },
  'Codorniz': { 'Pecho': 40, 'Pata': 15, 'Entera': 80 }
};

export interface FoodSelection {
  id: string;
  category: FoodCategory;
  portion: FoodPortion;
  quantity: number;
}

export interface DailyEntry {
  id: string;
  date: string;
  weightBefore: number;
  totalFoodWeight: number;
  foodSelections: FoodSelection[];
  predictedWeight?: number;
}

export interface Hawk {
  id: string;
  name: string;
  species: string;
  targetWeight: number;
  entries: DailyEntry[];
}

export type AppView = 'AUTH' | 'DASHBOARD' | 'HAWK_DETAILS' | 'ADD_HAWK' | 'ADD_ENTRY';