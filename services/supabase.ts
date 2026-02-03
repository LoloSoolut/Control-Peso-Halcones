import { createClient } from '@supabase/supabase-js';

// Intentar obtener las variables de entorno de cualquier fuente disponible
const getVar = (name: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.[name]) return import.meta.env[name];
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name];
  return '';
};

const supabaseUrl = getVar('https://esyzhzplfyoodjzmxvfd.supabase.co');
const supabaseKey = getVar('sb_publishable_p_uQaFT7nnBFVUspTf8dUA_54-ig3Rb');

// El modo Mock se activa si faltan las credenciales reales
export const IS_MOCK_MODE = !supabaseUrl || 
                           supabaseUrl === '' || 
                           supabaseUrl.includes('placeholder') || 
                           !supabaseKey;

class MockAuth {
  private callbacks: any[] = [];

  onAuthStateChange(cb: any) {
    this.callbacks.push(cb);
    const sessionStr = localStorage.getItem('falcon_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    setTimeout(() => cb('SIGNED_IN', session), 0);
    return { 
      data: { 
        subscription: { 
          unsubscribe: () => {
            this.callbacks = this.callbacks.filter(c => c !== cb);
          } 
        } 
      } 
    };
  }

  private notify(event: string, session: any) {
    this.callbacks.forEach(cb => cb(event, session));
  }

  private getUsers() {
    const users = localStorage.getItem('falcon_mock_users');
    return users ? JSON.parse(users) : {};
  }

  private saveUser(email: string, password: string) {
    const users = this.getUsers();
    users[email.toLowerCase()] = { password, id: `mock-user-${Math.random().toString(36).substr(2, 9)}` };
    localStorage.setItem('falcon_mock_users', JSON.stringify(users));
    return users[email.toLowerCase()];
  }

  async signInWithPassword({ email, password }: { email: string, password: any }) {
    const users = this.getUsers();
    const user = users[email.toLowerCase()];
    if (!user || user.password !== password) {
      return { data: { session: null }, error: { message: "Invalid credentials", status: 400 } };
    }
    const session = { user: { id: user.id, email }, access_token: 'mock-token-local' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    this.notify('SIGNED_IN', session);
    return { data: { session }, error: null };
  }

  async signUp({ email, password }: { email: string, password: any }) {
    const users = this.getUsers();
    if (users[email.toLowerCase()]) {
      return { data: { session: null }, error: { message: "Email already registered.", status: 400 } };
    }
    const newUser = this.saveUser(email, password);
    const session = { user: { id: newUser.id, email }, access_token: 'mock-token-local' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    this.notify('SIGNED_IN', session);
    return { data: { session }, error: null };
  }

  async signOut() {
    localStorage.removeItem('falcon_session');
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }

  async resetPasswordForEmail(email: string) {
    return { data: {}, error: null };
  }
}

// Inicializar el cliente real o el Mock según la disponibilidad de las llaves
export const supabase = IS_MOCK_MODE 
  ? { auth: new MockAuth() } as any
  : createClient(supabaseUrl, supabaseKey);