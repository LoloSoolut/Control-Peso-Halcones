import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  return '';
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

const isMock = !supabaseUrl || supabaseUrl === '' || supabaseUrl.includes('placeholder');

class MockAuth {
  onAuthStateChange(cb: any) {
    const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
    const timer = setTimeout(() => cb('INITIAL_SESSION', session), 200);
    return { data: { subscription: { unsubscribe: () => clearTimeout(timer) } } };
  }
  async signInWithPassword({ email }: any) {
    const session = { user: { id: 'mock-user', email }, access_token: 'mock-token' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    window.location.reload();
    return { data: { session }, error: null };
  }
  async signUp({ email }: any) { return this.signInWithPassword({ email }); }
  async signOut() {
    localStorage.removeItem('falcon_session');
    window.location.reload();
    return { error: null };
  }
}

export const supabase = isMock 
  ? { auth: new MockAuth() } as any
  : createClient(supabaseUrl, supabaseKey);

export const IS_MOCK_MODE = isMock;