
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://placeholder-project.supabase.co'; 
const supabaseKey = 'placeholder-key'; 

// Detecta si las claves son reales o valores por defecto
const isRealSupabase = 
  supabaseUrl.includes('supabase.co') && 
  !supabaseUrl.includes('placeholder-project') && 
  supabaseKey.length > 20 &&
  supabaseKey.startsWith('eyJ');

class MockSupabase {
  auth = {
    getSession: async () => {
      const session = localStorage.getItem('falcon_session');
      return { data: { session: session ? JSON.parse(session) : null }, error: null };
    },
    onAuthStateChange: (cb: any) => {
      // Simulación básica de eventos de auth
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
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

    const createResponse = (data: any) => {
      const promise = Promise.resolve({ data, error: null }) as any;
      promise.eq = (col: string, val: any) => {
        const filtered = Array.isArray(data) ? data.filter((i: any) => i[col] === val) : data;
        return createResponse(filtered);
      };
      promise.order = () => promise;
      promise.single = () => createResponse(Array.isArray(data) ? data[0] : data);
      promise.select = () => promise;
      return promise;
    };

    return {
      select: () => {
        let data = getData();
        if (table === 'hawks') {
          const entries = JSON.parse(localStorage.getItem('db_entries') || '[]');
          const food = JSON.parse(localStorage.getItem('db_food_items') || '[]');
          data = data.map((h: any) => ({
            ...h,
            entries: entries.filter((e: any) => e.hawk_id === h.id)
              .map((e: any) => ({ 
                ...e, 
                food_items: food.filter((f: any) => f.entry_id === e.id) 
              }))
          }));
        }
        return createResponse(data);
      },
      insert: (rows: any[]) => {
        const current = getData();
        const newRows = rows.map(r => ({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() }));
        saveData([...current, ...newRows]);
        return createResponse(newRows[0]);
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

export const supabase = isRealSupabase 
  ? createClient(supabaseUrl, supabaseKey) 
  : (new MockSupabase() as any);
