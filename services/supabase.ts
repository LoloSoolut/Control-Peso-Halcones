
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
// Debes reemplazar estos valores con los de tu proyecto en https://supabase.com
const supabaseUrl = 'https://esyzhzplfyoodjzmxvfd.supabase.co';
const supabaseKey = 'sb_publishable_p_uQaFT7nnBFVUspTf8dUA_54-ig3Rb';

// Verificamos si las claves son las de ejemplo para evitar el error "Failed to fetch"
const isPlaceholder = supabaseUrl.includes('tu-proyecto') || supabaseKey === 'tu-anon-key';

/**
 * MockSupabase: Una implementación mínima que usa localStorage como fallback
 * Esto permite que la aplicación sea FUNCIONAL inmediatamente sin configurar Supabase,
 * y se sincronice con la nube en cuanto el usuario ponga sus claves reales.
 */
class MockSupabase {
  auth = {
    getSession: async () => {
      const session = localStorage.getItem('falcon_mock_session');
      return { data: { session: session ? JSON.parse(session) : null }, error: null };
    },
    onAuthStateChange: (callback: any) => {
      // Simula el evento de cambio de auth
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

    const chain = {
      select: (query: string = '*') => ({
        eq: (col: string, val: any) => ({
          order: (col: string, { ascending }: any) => {
            let data = getLocalData().filter((item: any) => item[col] === val || !col);
            return Promise.resolve({ data, error: null });
          },
          single: () => {
            const data = getLocalData().find((item: any) => item[col] === val);
            return Promise.resolve({ data, error: null });
          }
        }),
        single: () => Promise.resolve({ data: null, error: null })
      }),
      insert: (rows: any[]) => ({
        select: () => ({
          single: () => {
            const current = getLocalData();
            const newRow = { ...rows[0], id: crypto.randomUUID(), created_at: new Date().toISOString() };
            saveLocalData([...current, newRow]);
            return Promise.resolve({ data: newRow, error: null });
          }
        })
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          const filtered = getLocalData().filter((item: any) => item[col] !== val);
          saveLocalData(filtered);
          return Promise.resolve({ error: null });
        }
      })
    };
    return chain;
  }
}

// Exportamos el cliente real o el mock según la configuración
export const supabase = isPlaceholder 
  ? (new MockSupabase() as any) 
  : createClient(supabaseUrl, supabaseKey);
