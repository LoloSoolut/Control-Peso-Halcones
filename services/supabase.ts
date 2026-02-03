import { createClient } from '@supabase/supabase-js';

/**
 * Obtiene una variable de entorno de forma segura, intentando primero con Vite (import.meta.env)
 * y cayendo en process.env si está disponible en el entorno de ejecución.
 */
const getEnvVar = (name: string): string => {
  try {
    // Intento con Vite (estándar para frontend moderno)
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (import.meta.env[name] as string) || '';
    }
  } catch (e) {
    // Silenciar errores de acceso a import.meta
  }

  try {
    // Intento con process.env (común en entornos híbridos o SSR)
    if (typeof process !== 'undefined' && process.env) {
      return (process.env[name] as string) || '';
    }
  } catch (e) {
    // Silenciar errores de acceso a process
  }

  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// El modo MOCK se activa si no hay credenciales válidas configuradas
export const IS_MOCK_MODE = !supabaseUrl || 
                           supabaseUrl === '' || 
                           supabaseUrl.includes('placeholder') || 
                           !supabaseKey;

/**
 * Emulación del sistema de autenticación de Supabase para funcionamiento offline/local
 * cuando no se han configurado las variables de entorno reales.
 */
class MockAuth {
  private callbacks: any[] = [];

  onAuthStateChange(cb: any) {
    this.callbacks.push(cb);
    const sessionStr = localStorage.getItem('falcon_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    
    // Notificación asíncrona para simular comportamiento de red
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

  async signInWithPassword({ email }: { email: string }) {
    const session = { user: { id: 'mock-user-123', email }, access_token: 'mock-token-local' };
    localStorage.setItem('falcon_session', JSON.stringify(session));
    this.notify('SIGNED_IN', session);
    return { data: { session }, error: null };
  }

  async signUp({ email }: { email: string }) {
    return this.signInWithPassword({ email });
  }

  async signOut() {
    localStorage.removeItem('falcon_session');
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }
}

// Exportación del cliente: Real si hay variables, Mock si no las hay
export const supabase = IS_MOCK_MODE 
  ? { auth: new MockAuth() } as any
  : createClient(supabaseUrl, supabaseKey);
