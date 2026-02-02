
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = 'https://esyzhzplfyoodjzmxvfd.supabase.co';
// Widening the type to string to avoid literal type comparison errors in isPlaceholder
const supabaseKey: string = 'sb_publishable_p_uQaFT7nnBFVUspTf8dUA_54-ig3Rb';

// Las claves de Supabase Anon reales son JWTs que empiezan por 'eyJ'.
// Si la clave no parece válida o es la de ejemplo, activamos el Mock.
const isPlaceholder = 
  supabaseUrl.includes('tu-proyecto') || 
  supabaseKey === 'tu-anon-key' || 
  supabaseKey.startsWith('sb_'); // Detectamos si se ha puesto una clave que no es de Supabase Anon

class MockSupabase {
  auth = {
    getSession: async () => {
      const session = localStorage.getItem('falcon_mock_session');
      return { data: { session: session ? JSON.parse(session) : null }, error: null };
    },
    onAuthStateChange: (callback: any) => {
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithPassword: async ({ email }: any) => {
      const user = { id: 'mock-user-id', email };
      const session = { user, access_token: 'mock-token' };
      localStorage.setItem('falcon_mock_session', JSON.stringify(session));
      return { data: { session, user }, error: null };
    },
    signUp: async ({ email }: any) => {
      const user = { id: 'mock-user-id', email };
      return { data: { user }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem('falcon_mock_session');
      return { error: null };
    }
  };

  from(table: string) {
    const getLocalData = () => JSON.parse(localStorage.getItem(`mock_db_${table}`) || '[]');
    const saveLocalData = (data: any) => localStorage.setItem(`mock_db_${table}`, JSON.stringify(data));

    // Helper para simular una respuesta de Supabase (Thenable)
    const createResponse = (data: any) => {
      const resp = Promise.resolve({ data, error: null }) as any;
      resp.eq = () => createResponse(data);
      resp.order = () => createResponse(data);
      resp.single = () => createResponse(Array.isArray(data) ? data[0] : data);
      resp.select = () => createResponse(data);
      return resp;
    };

    return {
      select: (query: string = '*') => {
        let data = getLocalData();
        // Simulación básica de joins para el Mock
        if (table === 'hawks') {
          const entries = JSON.parse(localStorage.getItem('mock_db_entries') || '[]');
          const food = JSON.parse(localStorage.getItem('mock_db_food_items') || '[]');
          data = data.map((h: any) => ({
            ...h,
            entries: entries
              .filter((e: any) => e.hawk_id === h.id)
              .map((e: any) => ({
                ...e,
                food_items: food.filter((f: any) => f.entry_id === e.id)
              }))
          }));
        }
        return createResponse(data);
      },
      insert: (rows: any[]) => {
        const current = getLocalData();
        const newRows = rows.map(r => ({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() }));
        saveLocalData([...current, ...newRows]);
        return createResponse(newRows[0]);
      },
      delete: () => {
        return {
          eq: (col: string, val: any) => {
            const filtered = getLocalData().filter((item: any) => item[col] !== val);
            saveLocalData(filtered);
            return Promise.resolve({ error: null });
          }
        };
      }
    };
  }
}

export const supabase = isPlaceholder 
  ? (new MockSupabase() as any) 
  : createClient(supabaseUrl, supabaseKey);
