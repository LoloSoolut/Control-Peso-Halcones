import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, 
  Plus, 
  ChevronLeft, 
  History, 
  Utensils,
  Trash2,
  LogOut,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { Hawk, ViewState, FoodType, FoodPortion } from './types.ts';
import { getHawks, createHawk, deleteHawk, saveEntry } from './services/db.ts';
import { supabase } from './services/supabase.ts';
import { 
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

const IS_MOCK = !supabase?.auth?.signInWithOtp; 

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-white text-slate-900">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Error Crítico</h2>
          <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl flex items-center gap-2 font-bold mt-4">
            <RefreshCcw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data?.session) {
           alert('Cuenta creada. Ahora puedes entrar.');
           setIsLogin(true);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-6 text-slate-900">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl rotate-3">
            <Bird className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">FalconWeight</h2>
          <p className="mt-2 text-slate-500 font-medium italic">Control de cetrería profesional</p>
          
          {IS_MOCK && (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-100">
              <Smartphone className="w-3 h-3" /> Modo Almacenamiento Local
            </div>
          )}
        </div>
        
        <form onSubmit={handleAuth} className="mt-8 space-y-4">
          <div className="space-y-3">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all bg-white" placeholder="Email" />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all bg-white" placeholder="Contraseña" />
            </div>
          </div>
          
          {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold flex items-center gap-3 animate-pulse"><AlertCircle className="w-5 h-5" /> {error}</div>}
          
          <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-slate-900 text-white font-bold py-5 rounded-2xl shadow-2xl active:scale-95 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
          </button>
        </form>
        
        <div className="text-center pt-4">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            {isLogin ? '¿No tienes cuenta? Registrate aquí' : '¿Ya tienes cuenta? Entra aquí'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [view, setView] = useState<ViewState>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawk, setSelectedHawk] = useState<Hawk | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [newHawkName, setNewHawkName] = useState('');
  const [newHawkSpecies, setNewHawkSpecies] = useState('');
  const [newHawkTargetWeight, setNewHawkTargetWeight] = useState<string>('');
  const [weightBefore, setWeightBefore] = useState<string>('');
  const [weightAfter, setWeightAfter] = useState<string>('');
  const [currentFoodItems, setCurrentFoodItems] = useState<any[]>([]);
  const [selectedFoodType, setSelectedFoodType] = useState<FoodType>(FoodType.PALOMA);
  const [selectedFoodPortion, setSelectedFoodPortion] = useState<FoodPortion>(FoodPortion.ALA);

  const refreshData = async (userId: string) => {
    try {
      setLoading(true);
      const data = await getHawks(userId);
      setHawks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setView('HOME');
          await refreshData(session.user.id);
        } else {
          setView('AUTH');
        }
      } catch (err) {
        console.error("Auth init error", err);
        setView('AUTH');
      } finally {
        setLoading(false);
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setView('HOME');
        refreshData(session.user.id);
      } else {
        setUser(null);
        setView('AUTH');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const chartData = useMemo(() => {
    if (!selectedHawk || !selectedHawk.entries) return [];
    return [...selectedHawk.entries]
      .reverse()
      .slice(-7)
      .map(e => ({ 
        name: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), 
        peso: Number(e.weightBefore) 
      }));
  }, [selectedHawk]);

  if (loading && view !== 'AUTH') {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-slate-50 text-slate-900">
        <Loader2 className="animate-spin w-10 h-10 text-slate-900 mb-4" />
        <p className="text-slate-400 font-bold">Iniciando cetrería...</p>
      </div>
    );
  }

  if (view === 'AUTH') return <AuthScreen />;

  return (
    <div className="max-w-md mx-auto h-full bg-slate-50 relative flex flex-col overflow-hidden shadow-2xl border-x border-slate-100 text-slate-900">
      {view === 'HOME' && (
        <>
          <header className="p-6 bg-white border-b flex justify-between items-center sticky top-0 z-20">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-black text-slate-900">Mis Halcones</h1>
                {IS_MOCK ? (
                  <Smartphone className="w-4 h-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{hawks.length} registrados</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => supabase.auth.signOut()} title="Cerrar sesión" className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl transition-colors"><LogOut className="w-5 h-5" /></button>
              <button onClick={() => setView('ADD_HAWK')} className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl shadow-lg active:scale-90 transition-transform"><Plus className="w-6 h-6" /></button>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 no-scrollbar">
            {hawks.length === 0 ? (
              <div className="text-center py-32 space-y-4 opacity-40">
                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto"><Bird className="w-10 h-10" /></div>
                <p className="font-bold">Añade tu primer halcón</p>
              </div>
            ) : (
              hawks.map(hawk => (
                <div key={hawk.id} onClick={() => { setSelectedHawk(hawk); setView('HAWK_DETAIL'); }} className="group bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Bird className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{hawk.name}</h3>
                      <p className="text-xs font-semibold text-slate-400">{hawk.species}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase">Hoy</p>
                    <p className="text-xl font-black text-slate-900">{hawk.entries[0]?.weightBefore || '--'}<span className="text-sm ml-0.5 font-bold">g</span></p>
                  </div>
                </div>
              ))
            )}
          </main>
        </>
      )}

      {view === 'ADD_HAWK' && (
        <>
          <header className="p-6 bg-white border-b flex items-center gap-4">
            <button onClick={() => setView('HOME')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-black">Nuevo Halcón</h1>
          </header>
          <main className="p-6 space-y-5">
            <input type="text" value={newHawkName} onChange={e => setNewHawkName(e.target.value)} placeholder="Nombre" className="w-full p-4 rounded-2xl border border-slate-200 bg-white font-bold" />
            <input type="text" value={newHawkSpecies} onChange={e => setNewHawkSpecies(e.target.value)} placeholder="Especie" className="w-full p-4 rounded-2xl border border-slate-200 bg-white font-bold" />
            <input type="number" value={newHawkTargetWeight} onChange={e => setNewHawkTargetWeight(e.target.value)} placeholder="Peso Meta (g)" className="w-full p-4 rounded-2xl border border-slate-200 bg-white font-bold" />
            <button onClick={async () => {
              if (user && newHawkName) {
                await createHawk(newHawkName, newHawkSpecies, parseInt(newHawkTargetWeight) || 0, user.id);
                await refreshData(user.id);
                setView('HOME');
              }
            }} className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl shadow-xl">Guardar</button>
          </main>
        </>
      )}

      {view === 'HAWK_DETAIL' && selectedHawk && (
        <>
          <header className="p-6 bg-white border-b flex justify-between items-center z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('HOME')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-5 h-5" /></button>
              <h1 className="text-xl font-black">{selectedHawk.name}</h1>
            </div>
            <button onClick={async () => { if(confirm('¿Borrar?')) { await deleteHawk(selectedHawk.id); setView('HOME'); refreshData(user.id); } }} className="p-2 text-slate-300"><Trash2 className="w-5 h-5" /></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-28">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 text-white p-5 rounded-3xl">
                <p className="text-[10px] opacity-60 font-black mb-1">PESO ACTUAL</p>
                <h4 className="text-3xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}g</h4>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-200">
                <p className="text-[10px] text-slate-400 font-black mb-1">META</p>
                <h4 className="text-3xl font-black">{selectedHawk.targetWeight}g</h4>
              </div>
            </div>
            <div className="h-44 w-full bg-white p-4 rounded-3xl border border-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Area type="monotone" dataKey="peso" stroke="#0f172a" fill="#0f172a10" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-3">
                {selectedHawk.entries.map(entry => (
                    <div key={entry.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center">
                        <span className="font-bold capitalize">{new Date(entry.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</span>
                        <span className="font-black">{entry.weightBefore}g → {entry.weightAfter}g</span>
                    </div>
                ))}
            </div>
          </main>
          <div className="fixed bottom-8 left-0 right-0 px-8">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full bg-slate-900 text-white py-5 rounded-2xl shadow-2xl font-black">
              ANOTAR PESO
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-6 bg-white border-b flex items-center gap-4">
            <button onClick={() => setView('HAWK_DETAIL')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-black">Registro Diario</h1>
          </header>
          <main className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <input type="number" value={weightBefore} onChange={e => setWeightBefore(e.target.value)} placeholder="Antes (g)" className="p-5 rounded-2xl border-2 border-slate-100 font-black text-xl" />
              <input type="number" value={weightAfter} onChange={e => setWeightAfter(e.target.value)} placeholder="Después (g)" className="p-5 rounded-2xl border-2 border-slate-100 font-black text-xl" />
            </div>
            <div className="bg-slate-50 p-5 rounded-3xl border-2 border-dashed border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <select value={selectedFoodType} onChange={e => setSelectedFoodType(e.target.value as FoodType)} className="p-3 rounded-xl border">
                    {Object.values(FoodType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select value={selectedFoodPortion} onChange={e => setSelectedFoodPortion(e.target.value as FoodPortion)} className="p-3 rounded-xl border">
                    {Object.values(FoodPortion).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <button onClick={() => setCurrentFoodItems([...currentFoodItems, { id: crypto.randomUUID(), type: selectedFoodType, portion: selectedFoodPortion, quantity: 1 }])} className="w-full py-2 bg-white border rounded-xl text-xs font-bold">
                  + Añadir porción
                </button>
            </div>
            <button onClick={async () => {
              if (selectedHawk && weightBefore && weightAfter) {
                await saveEntry(selectedHawk.id, parseFloat(weightBefore), parseFloat(weightAfter), currentFoodItems);
                await refreshData(user.id);
                const updated = (await getHawks(user.id)).find(h => h.id === selectedHawk.id);
                if (updated) setSelectedHawk(updated);
                setView('HAWK_DETAIL');
              }
            }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-xl">Guardar Registro</button>
          </main>
        </>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;