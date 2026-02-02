import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  try {
    // Intento de lectura compatible con múltiples entornos
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    return '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

// Si no hay credenciales, modo local automático
const isMock = !supabaseUrl || supabaseUrl === '' || supabaseUrl.includes('placeholder');

class MockAuth {
  onAuthStateChange(cb: any) {
    const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
    // Pequeño delay para simular carga real y permitir que React se monte
    const timer = setTimeout(() => cb('INITIAL_SESSION', session), 200);
    return { data: { subscription: { unsubscribe: () => clearTimeout(timer) } } };
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
      delete: () => ({ eq: () => Promise.resolve({ error: null }) })
    };
  }
}

export const supabase = isMock 
  ? { auth: new MockAuth(), from: (t: string) => new MockDB().from(t) } as any
  : createClient(supabaseUrl, supabaseKey);

export const IS_MOCK_MODE = isMock;