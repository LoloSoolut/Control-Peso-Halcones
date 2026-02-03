import { createClient } from '@supabase/supabase-js';

// Función para obtener variables de entorno
const getVar = (name: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.[name]) return import.meta.env[name];
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name];
  return '';
};

// URL y KEY de tu proyecto de Supabase
// NOTA: He puesto tus valores directamente aquí para que funcione de inmediato.
const supabaseUrl = getVar('VITE_SUPABASE_URL') || 'https://esyzhzplfyoodjzmxvfd.supabase.co';
const supabaseKey = getVar('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzeXpoenBsZnlvb2Rqem14dmZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDMzOTksImV4cCI6MjA4NTYxOTM5OX0.SG70OEQT-6_DVp-eP_dPXM1lj8GBax2AQ7DL9Kro8Kc';

// El modo Mock se activa SOLO si realmente no hay valores
export const IS_MOCK_MODE = !supabaseUrl || 
                           supabaseUrl === '' || 
                           supabaseUrl.includes('placeholder') || 
                           !supabaseKey ||
                           supabaseKey === '';

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
      return { data: { session: null }, error: { message: "Credenciales inválidas (Modo Local)", status: 400 } };
    }
    const session = { user: { id: user.id, email }, access_token: 'mock-token-local' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    this.notify('SIGNED_IN', session);
    return { data: { session }, error: null };
  }

  async signUp({ email, password }: { email: string, password: any }) {
    const users = this.getUsers();
    if (users[email.toLowerCase()]) {
      return { data: { session: null }, error: { message: "Email ya registrado localmente.", status: 400 } };
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

// Inicializar el cliente real o el Mock
export const supabase = IS_MOCK_MODE 
  ? { auth: new MockAuth() } as any
  : createClient(supabaseUrl, supabaseKey);