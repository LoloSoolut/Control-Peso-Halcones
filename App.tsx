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
import { Hawk, ViewState, FoodType, FoodPortion, DailyEntry } from './types';
import { getHawks, createHawk, deleteHawk, saveEntry } from './services/db';
import { supabase } from './services/supabase';
import { 
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

// Detectar de forma robusta si estamos en modo Local Storage o Supabase
const IS_MOCK = !supabase?.auth?.signInWithOtp; 

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-white">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Algo ha fallado</h2>
          <p className="text-slate-500 mb-6">La aplicación no ha podido cargar los módulos correctamente.</p>
          <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg">
            <RefreshCcw className="w-4 h-4" /> Recargar aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Auth Component ---
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
    <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-6">
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

// --- App Principal ---
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
      <div className="flex flex-col h-full items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin w-10 h-10 text-slate-900 mb-4" />
        <p className="text-slate-400 font-bold">Cargando cetrería...</p>
      </div>
    );
  }

  if (view === 'AUTH') return <AuthScreen />;

  return (
    <div className="max-w-md mx-auto h-full bg-slate-50 relative flex flex-col overflow-hidden shadow-2xl border-x border-slate-100">
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
                <p className="font-bold">Empieza añadiendo tu primer halcón</p>
              </div>
            ) : (
              hawks.map(hawk => (
                <div key={hawk.id} onClick={() => { setSelectedHawk(hawk); setView('HAWK_DETAIL'); }} className="group bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center active:scale-[0.98] transition-all hover:border-slate-400 cursor-pointer">
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
                    <p className="text-[10px] font-black text-slate-300 uppercase">Peso hoy</p>
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
            <h1 className="text-xl font-black">Registrar Halcón</h1>
          </header>
          <main className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase ml-2">Nombre</label>
              <input type="text" value={newHawkName} onChange={e => setNewHawkName(e.target.value)} placeholder="Ej. Turul" className="w-full p-4 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-4 focus:ring-slate-900/5 transition-all font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase ml-2">Especie</label>
              <input type="text" value={newHawkSpecies} onChange={e => setNewHawkSpecies(e.target.value)} placeholder="Ej. Halcón Peregrino" className="w-full p-4 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-4 focus:ring-slate-900/5 transition-all font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase ml-2">Peso de vuelo / Meta (g)</label>
              <input type="number" value={newHawkTargetWeight} onChange={e => setNewHawkTargetWeight(e.target.value)} placeholder="850" className="w-full p-4 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-4 focus:ring-slate-900/5 transition-all font-bold" />
            </div>
            
            <button onClick={async () => {
              if (user && newHawkName) {
                const weight = parseInt(newHawkTargetWeight) || 0;
                await createHawk(newHawkName, newHawkSpecies, weight, user.id);
                await refreshData(user.id);
                setView('HOME');
                setNewHawkName(''); setNewHawkSpecies(''); setNewHawkTargetWeight('');
              }
            }} className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl shadow-2xl active:scale-95 transition-all mt-4">Guardar Halcón</button>
          </main>
        </>
      )}

      {view === 'HAWK_DETAIL' && selectedHawk && (
        <>
          <header className="p-6 bg-white border-b flex justify-between items-center z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('HOME')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-5 h-5" /></button>
              <div>
                <h1 className="text-xl font-black">{selectedHawk.name}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedHawk.species}</p>
              </div>
            </div>
            <button onClick={async () => { if(confirm('¿Seguro que quieres borrar este halcón?')) { await deleteHawk(selectedHawk.id); setView('HOME'); refreshData(user.id); } }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-28 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl">
                <p className="text-[10px] opacity-60 uppercase font-black tracking-widest mb-1">Peso actual</p>
                <h4 className="text-3xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-sm opacity-60 ml-1 font-bold">g</span></h4>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Peso meta</p>
                <h4 className="text-3xl font-black text-slate-900">{selectedHawk.targetWeight}<span className="text-sm text-slate-300 ml-1 font-bold">g</span></h4>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Gráfica Semanal</h3>
                <Scale className="w-4 h-4 text-slate-300" />
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="peso" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorPeso)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-black flex items-center gap-2 text-sm text-slate-900 px-1 uppercase tracking-wider"><History className="w-4 h-4" /> Historial Reciente</h3>
              <div className="space-y-3">
                {selectedHawk.entries.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-8 italic">No hay registros hoy</p>
                ) : (
                  selectedHawk.entries.map(entry => (
                    <div key={entry.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-black text-slate-900 capitalize">{new Date(entry.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">
                          +{Math.round(Number(entry.weightAfter) - Number(entry.weightBefore))}g ceba
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {entry.foodItems.map((f: any) => (
                          <span key={f.id} className="text-[10px] px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg border border-slate-100 uppercase font-black">
                            {f.type} • {f.portion}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
          
          <div className="fixed bottom-8 left-0 right-0 px-8 z-30">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-5 rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.3)] active:scale-95 transition-all font-black text-lg">
              <Plus className="w-6 h-6" /> Anotar Peso
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-6 bg-white border-b flex items-center gap-4 sticky top-0 z-20">
            <button onClick={() => setView('HAWK_DETAIL')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-black">Registro Diario</h1>
          </header>
          
          <main className="flex-1 overflow-y-auto p-6 space-y-8 pb-32 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Peso antes (g)</label>
                <input type="number" value={weightBefore} onChange={e => setWeightBefore(e.target.value)} placeholder="0" className="w-full p-5 rounded-2xl border-2 border-slate-100 bg-white text-2xl font-black focus:border-slate-900 outline-none transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Peso después (g)</label>
                <input type="number" value={weightAfter} onChange={e => setWeightAfter(e.target.value)} placeholder="0" className="w-full p-5 rounded-2xl border-2 border-slate-100 bg-white text-2xl font-black focus:border-slate-900 outline-none transition-colors" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Utensils className="w-4 h-4" /> Comida suministrada
                </h3>
              </div>
              
              <div className="bg-slate-50 p-5 rounded-3xl border-2 border-dashed border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <select value={selectedFoodType} onChange={e => setSelectedFoodType(e.target.value as FoodType)} className="p-4 border border-slate-200 rounded-2xl bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900/5 transition-all">
                    {Object.values(FoodType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select value={selectedFoodPortion} onChange={e => setSelectedFoodPortion(e.target.value as FoodPortion)} className="p-4 border border-slate-200 rounded-2xl bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900/5 transition-all">
                    {Object.values(FoodPortion).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                
                <button onClick={() => setCurrentFoodItems([...currentFoodItems, { id: crypto.randomUUID(), type: selectedFoodType, portion: selectedFoodPortion, quantity: 1 }])} className="w-full py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 shadow-sm active:scale-95 transition-transform">
                  + Añadir porción
                </button>
                
                <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                  {currentFoodItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900">{item.type}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.portion}</span>
                      </div>
                      <button onClick={() => setCurrentFoodItems(currentFoodItems.filter(i => i.id !== item.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
          
          <div className="p-6 bg-white border-t sticky bottom-0 z-20 safe-bottom">
            <button onClick={async () => {
              if (selectedHawk && weightBefore && weightAfter) {
                const ok = await saveEntry(selectedHawk.id, parseFloat(weightBefore), parseFloat(weightAfter), currentFoodItems);
                if (ok) {
                  await refreshData(user.id);
                  const updatedHawks = await getHawks(user.id);
                  const found = updatedHawks.find(h => h.id === selectedHawk.id);
                  if (found) setSelectedHawk(found);
                  setView('HAWK_DETAIL');
                  setWeightBefore(''); setWeightAfter(''); setCurrentFoodItems([]);
                } else {
                  alert('Error al guardar datos');
                }
              } else {
                alert('Introduce los pesos para guardar');
              }
            }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-2xl active:scale-95 transition-all">Guardar registro</button>
          </div>
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