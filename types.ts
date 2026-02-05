export type FoodCategory = 'Pigeon' | 'Quail' | 'Chick' | 'Duck' | 'Partridge';
export type FoodPortion = 'Whole' | 'Breast' | 'Leg' | 'With Yolk' | 'No Yolk';

export const FOOD_WEIGHT_MAP: Record<FoodCategory, Partial<Record<FoodPortion, number>>> = {
  'Chick': { 'With Yolk': 25, 'No Yolk': 20 },
  'Pigeon': { 'Breast': 45, 'Leg': 20, 'Whole': 100 },
  'Partridge': { 'Breast': 60, 'Leg': 35, 'Whole': 150 },
  'Duck': { 'Breast': 100, 'Leg': 50, 'Whole': 300 },
  'Quail': { 'Breast': 40, 'Leg': 20, 'Whole': 80 }
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
  notes?: string;
  predictedWeight?: number;
}

export interface Hawk {
  id: string;
  name: string;
  species: string;
  targetWeight: number;
  entries: DailyEntry[];
}

export type AppView = 'AUTH' | 'SIGNUP' | 'RECOVER' | 'DASHBOARD' | 'HAWK_DETAILS' | 'ADD_HAWK' | 'ADD_ENTRY';