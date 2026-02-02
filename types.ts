export enum FoodType {
  PALOMA = 'Paloma',
  CODORNIZ = 'Codorniz',
  POLLITO = 'Pollito',
  PATO = 'Pato',
  CONEJO = 'Conejo',
  RATA = 'Rata'
}

export enum FoodPortion {
  ALA = 'Ala',
  PATA = 'Pata',
  PECHUGA = 'Pechuga',
  CABEZA = 'Cabeza',
  ENTERO = 'Entero',
  MEDIO = 'Medio'
}

export interface FoodItem {
  id: string;
  type: FoodType;
  portion: FoodPortion;
  quantity: number;
}

export interface DailyEntry {
  id: string;
  date: string;
  weightBefore: number;
  weightAfter: number;
  foodItems: FoodItem[];
  notes?: string;
}

export interface Hawk {
  id: string;
  name: string;
  species: string;
  targetWeight: number;
  entries: DailyEntry[];
}

export type ViewState = 'AUTH' | 'HOME' | 'HAWK_DETAIL' | 'ADD_HAWK' | 'ADD_ENTRY';