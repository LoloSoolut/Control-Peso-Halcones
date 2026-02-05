import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://esyzhzplfyoodjzmxvfd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzeXpoenBsZnlvb2Rqem14dmZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDMzOTksImV4cCI6MjA4NTYxOTM5OX0.SG70OEQT-6_DVp-eP_dPXM1lj8GBax2AQ7DL9Kro8Kc';

// Detectamos si forzamos modo local o si las llaves fallan
export const IS_MOCK_MODE = !supabaseUrl || supabaseUrl.includes('placeholder') || localStorage.getItem('falcon_use_local') === 'true';

console.log(`[Falcon PRO] Database Mode: ${IS_MOCK_MODE ? 'LOCAL/GUEST' : 'REAL/SUPABASE'}`);

// Simulador de base de datos para modo Invitado
class MockSupabase {
  auth = {
    onAuthStateChange: (cb: any) => {
      const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
      setTimeout(() => cb('SIGNED_IN', session), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithPassword: async ({ email }: any) => {
      const session = { user: { id: 'guest-user', email: email || 'invitado@falcon.pro' }, access_token: 'guest' };
      localStorage.setItem('falcon_session', JSON.stringify(session));
      localStorage.setItem('falcon_use_local', 'true');
      return { data: { session }, error: null };
    },
    signUp: async ({ email }: any) => {
      return { data: { user: { email }, session: null }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem('falcon_session');
      localStorage.removeItem('falcon_use_local');
      window.location.reload();
      return { error: null };
    },
    resetPasswordForEmail: async () => ({ data: {}, error: null })
  };

  from(table: string) {
    return {
      select: (query: string) => ({
        eq: (col: string, val: any) => {
          const data = JSON.parse(localStorage.getItem(`mock_${table}`) || '[]');
          // Simulación básica de joins
          if (query.includes('*') && table === 'hawks') {
            const entries = JSON.parse(localStorage.getItem('mock_entries') || '[]');
            const joined = data.map((h: any) => ({
              ...h,
              entries: entries.filter((e: any) => e.hawk_id === h.id)
            }));
            return Promise.resolve({ data: joined, error: null });
          }
          return Promise.resolve({ data, error: null });
        }
      }),
      insert: (items: any[]) => {
        const data = JSON.parse(localStorage.getItem(`mock_${table}`) || '[]');
        const newItems = items.map(item => ({ 
          id: Math.random().toString(36).substr(2, 9), 
          created_at: new Date().toISOString(),
          ...item 
        }));
        localStorage.setItem(`mock_${table}`, JSON.stringify([...newItems, ...data]));
        return { select: () => ({ single: () => Promise.resolve({ data: newItems[0], error: null }) }), error: null };
      },
      delete: () => ({
        eq: (col: string, val: any) => {
          const data = JSON.parse(localStorage.getItem(`mock_${table}`) || '[]');
          const filtered = data.filter((item: any) => item[col] !== val);
          localStorage.setItem(`mock_${table}`, JSON.stringify(filtered));
          return Promise.resolve({ error: null });
        }
      })
    };
  }
}

export const supabase = IS_MOCK_MODE 
  ? new MockSupabase() as any 
  : createClient(supabaseUrl, supabaseKey);
