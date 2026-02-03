import { createClient } from '@supabase/supabase-js';

// URL y KEY de tu proyecto de Supabase obtenidas de tu configuración
const supabaseUrl = 'https://esyzhzplfyoodjzmxvfd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzeXpoenBsZnlvb2Rqem14dmZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDMzOTksImV4cCI6MjA4NTYxOTM5OX0.SG70OEQT-6_DVp-eP_dPXM1lj8GBax2AQ7DL9Kro8Kc';

// El modo Mock se activa solo si las llaves son inválidas o placeholders
export const IS_MOCK_MODE = !supabaseUrl || 
                           supabaseUrl.includes('placeholder') || 
                           !supabaseKey || 
                           supabaseKey.length < 20;

console.log(`[Falcon PRO] Database Mode: ${IS_MOCK_MODE ? 'LOCAL/DEMO' : 'REAL/SUPABASE'}`);

class MockAuth {
  private callbacks: any[] = [];
  onAuthStateChange(cb: any) {
    this.callbacks.push(cb);
    const session = JSON.parse(localStorage.getItem('falcon_session') || 'null');
    setTimeout(() => cb('SIGNED_IN', session), 0);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  async signInWithPassword({ email, password }: any) {
    const session = { user: { id: 'local-user', email }, access_token: 'abc' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    return { data: { session }, error: null };
  }
  async signUp({ email }: any) {
    return { data: { user: { email }, session: null }, error: null };
  }
  async signOut() {
    localStorage.removeItem('falcon_session');
    return { error: null };
  }
}

export const supabase = IS_MOCK_MODE 
  ? { auth: new MockAuth() } as any
  : createClient(supabaseUrl, supabaseKey);