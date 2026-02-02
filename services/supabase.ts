import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

const isMock = !supabaseUrl || supabaseUrl.includes('placeholder');

class MockAuth {
  onAuthStateChange(cb: any) {
    const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
    cb('INITIAL_SESSION', session);
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
          order: () => Promise.resolve({ data: JSON.parse(localStorage.getItem(`mock_${table}`) || '[]'), error: null })
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