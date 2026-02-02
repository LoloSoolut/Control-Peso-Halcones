
export enum FoodType {
  PALOMA = 'Paloma',
  CODORNIZ = 'Codorniz',
  POLLITO = 'Pollito',
  PATO = 'Pato'
}

export enum FoodPortion {
  ALA = 'Ala',
  PATA = 'Pata',
  PECHUGA = 'Pechuga',
  CABEZA = 'Cabeza',
  ENTERO = 'Entero'
}

export interface FoodEntry {
  id: string;
  entry_id: string;
  type: FoodType;
  portion: FoodPortion;
  quantity: number;
}

export interface DailyEntry {
  id: string;
  hawk_id: string;
  date: string;
  weightBefore: number;
  weightAfter: number;
  foodItems: FoodEntry[];
  notes?: string;
}

export interface Hawk {
  id: string;
  user_id: string;
  name: string;
  species: string;
  targetWeight: number;
  entries: DailyEntry[];
  createdAt: string;
}

export type ViewState = 'AUTH' | 'HOME' | 'HAWK_DETAIL' | 'ADD_ENTRY' | 'ADD_HAWK';
