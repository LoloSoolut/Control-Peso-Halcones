
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURACIÓN DE SUPABASE
 * ------------------------
 * 1. Ve a supabase.com
 * 2. Crea un proyecto.
 * 3. En Settings > API busca la 'URL' y la 'anon public key'.
 */
const supabaseUrl = 'https://tu-proyecto.supabase.co'; 
const supabaseKey = 'tu-clave-anon'; 

// Verificamos si las claves son reales (Las de Supabase empiezan por 'eyJ...')
const isRealSupabase = 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('tu-proyecto') && 
  supabaseKey.startsWith('eyJ');

/**
 * MockSupabase: Sistema de respaldo para que la app funcione sin internet
 * o sin configuración de base de datos (usando memoria local del móvil).
 */
class MockSupabase {
  auth = {
    getSession: async () => {
      const session = localStorage.getItem('falcon_session');
      return { data: { session: session ? JSON.parse(session) : null }, error: null };
    },
    onAuthStateChange: (cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async ({ email }: any) => {
      const session = { user: { id: 'local-user', email }, access_token: 'local-token' };
      localStorage.setItem('falcon_session', JSON.stringify(session));
      return { data: { session, user: session.user }, error: null };
    },
    signUp: async ({ email }: any) => ({ data: { user: { id: 'local-user', email } }, error: null }),
    signOut: async () => {
      localStorage.removeItem('falcon_session');
      return { error: null };
    }
  };

  from(table: string) {
    const getData = () => JSON.parse(localStorage.getItem(`db_${table}`) || '[]');
    const saveData = (d: any) => localStorage.setItem(`db_${table}`, JSON.stringify(d));

    const queryMethods = (data: any) => {
      const promise = Promise.resolve({ data, error: null }) as any;
      promise.eq = (col: string, val: any) => {
        const filtered = Array.isArray(data) ? data.filter(i => i[col] === val) : data;
        return queryMethods(filtered);
      };
      promise.order = () => promise;
      promise.single = () => queryMethods(Array.isArray(data) ? data[0] : data);
      promise.select = () => promise;
      return promise;
    };

    return {
      select: () => {
        let data = getData();
        // Simular joins para que la app no pete
        if (table === 'hawks') {
          const entries = JSON.parse(localStorage.getItem('db_entries') || '[]');
          const food = JSON.parse(localStorage.getItem('db_food_items') || '[]');
          data = data.map((h: any) => ({
            ...h,
            entries: entries.filter((e: any) => e.hawk_id === h.id)
              .map((e: any) => ({ ...e, food_items: food.filter((f: any) => f.entry_id === e.id) }))
          }));
        }
        return queryMethods(data);
      },
      insert: (rows: any[]) => {
        const current = getData();
        const newRows = rows.map(r => ({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() }));
        saveData([...current, ...newRows]);
        return queryMethods(newRows[0]);
      },
      delete: () => ({
        eq: (col: string, val: any) => {
          saveData(getData().filter((i: any) => i[col] !== val));
          return Promise.resolve({ error: null });
        }
      })
    };
  }
}

// Exportamos el cliente: Real si hay claves, de lo contrario el Mock local.
export const supabase = isRealSupabase 
  ? createClient(supabaseUrl, supabaseKey) 
  : (new MockSupabase() as any);
