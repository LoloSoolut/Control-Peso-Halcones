import { createClient } from '@supabase/supabase-js';

// Función segura para obtener variables de entorno en el navegador
const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    return (typeof process !== 'undefined' && process.env?.[key]) || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

// Si no hay credenciales válidas, activamos el modo Mock (simulado) para que la app funcione siempre
const isMock = !supabaseUrl || supabaseUrl.includes('placeholder') || supabaseUrl === '';

class MockAuth {
  onAuthStateChange(cb: any) {
    const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
    // Pequeño delay para simular red
    setTimeout(() => cb('INITIAL_SESSION', session), 500);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  async getSession() {
    const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
    return { data: { session }, error: null };
  }
  async signInWithPassword({ email }: any) {
    const session = { user: { id: 'mock-user', email }, access_token: 'mock-token' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    window.location.reload();
    return { data: { session }, error: null };
  }
  async signUp({ email }: any) {
    return this.signInWithPassword({ email });
  }
  async signOut() {
    localStorage.removeItem('falcon_session');
    window.location.reload();
    return { error: null };
  }
}

class MockDB {
  from(table: string) {
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ 
            data: JSON.parse(localStorage.getItem(`mock_${table}`) || '[]'), 
            error: null 
          })
        }),
        single: () => Promise.resolve({ data: null, error: null })
      }),
      insert: (data: any) => {
        const current = JSON.parse(localStorage.getItem(`mock_${table}`) || '[]');
        localStorage.setItem(`mock_${table}`, JSON.stringify([...current, ...data]));
        return Promise.resolve({ data: data[0], error: null });
      },
      delete: () => ({ 
        eq: () => {
          // Lógica simplificada de borrado local
          return Promise.resolve({ error: null });
        } 
      })
    };
  }
}

export const supabase = isMock 
  ? { auth: new MockAuth(), from: (t: string) => new MockDB().from(t) } as any
  : createClient(supabaseUrl, supabaseKey);

export const IS_MOCK_MODE = isMock;