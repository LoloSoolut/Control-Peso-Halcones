import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}
  return '';
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

// Si no hay claves, activamos modo MOCK para que la app funcione igual
const isMock = !supabaseUrl || supabaseUrl === '' || supabaseUrl.includes('placeholder');

class MockAuth {
  private callbacks: any[] = [];

  onAuthStateChange(cb: any) {
    this.callbacks.push(cb);
    const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
    // Notificar estado inicial
    setTimeout(() => cb('SIGNED_IN', session), 100);
    return { data: { subscription: { unsubscribe: () => {
      this.callbacks = this.callbacks.filter(c => c !== cb);
    } } } };
  }

  private notify(event: string, session: any) {
    this.callbacks.forEach(cb => cb(event, session));
  }

  async signInWithPassword({ email }: any) {
    const session = { user: { id: 'mock-user-123', email }, access_token: 'mock-token' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    this.notify('SIGNED_IN', session);
    return { data: { session }, error: null };
  }

  async signUp({ email }: any) {
    return this.signInWithPassword({ email });
  }

  async signOut() {
    localStorage.removeItem('falcon_session');
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }
}

export const supabase = isMock 
  ? { auth: new MockAuth() } as any
  : createClient(supabaseUrl, supabaseKey);

export const IS_MOCK_MODE = isMock;