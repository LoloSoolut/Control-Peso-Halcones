import { createClient } from '@supabase/supabase-js';

// Fallback manual de ID para navegadores móviles antiguos o sin HTTPS
const safeUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

// URL y Key de ejemplo.
const supabaseUrl = 'https://placeholder-project.supabase.co'; 
const supabaseKey = 'placeholder-key'; 

const isValidConfig = () => {
  try {
    const isUrlValid = supabaseUrl && 
                       supabaseUrl.startsWith('https://') && 
                       !supabaseUrl.includes('placeholder-project');
    
    const isKeyValid = supabaseKey && 
                       supabaseKey.length > 30 && 
                       supabaseKey !== 'placeholder-key';

    return isUrlValid && isKeyValid;
  } catch {
    return false;
  }
};

class MockSupabase {
  private authStateChangeCallback: ((event: string, session: any) => void) | null = null;

  auth = {
    getSession: async () => {
      const session = localStorage.getItem('falcon_session');
      return { data: { session: session ? JSON.parse(session) : null }, error: null };
    },
    onAuthStateChange: (cb: any) => {
      this.authStateChangeCallback = cb;
      return { data: { subscription: { unsubscribe: () => { this.authStateChangeCallback = null; } } } };
    },
    signInWithPassword: async ({ email }: any) => {
      const session = { user: { id: 'local-user', email }, access_token: 'local-token' };
      localStorage.setItem('falcon_session', JSON.stringify(session));
      if (this.authStateChangeCallback) this.authStateChangeCallback('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    },
    signUp: async ({ email }: any) => {
      const session = { user: { id: 'local-user', email }, access_token: 'local-token' };
      localStorage.setItem('falcon_session', JSON.stringify(session));
      if (this.authStateChangeCallback) this.authStateChangeCallback('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem('falcon_session');
      if (this.authStateChangeCallback) this.authStateChangeCallback('SIGNED_OUT', null);
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
        const newRows = rows.map(r => ({ ...r, id: safeUUID(), created_at: new Date().toISOString() }));
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

let supabaseClient: any;

try {
  if (isValidConfig()) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  } else {
    supabaseClient = new MockSupabase();
  }
} catch (e) {
  console.warn("Supabase init fallback:", e);
  supabaseClient = new MockSupabase();
}

export const supabase = supabaseClient;