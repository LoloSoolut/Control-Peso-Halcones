
import React, { useState, useEffect } from 'react';
import { 
  Bird, 
  Plus, 
  ChevronLeft, 
  History, 
  Scale, 
  Utensils,
  TrendingUp,
  Trash2,
  LogOut,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCcw
} from 'lucide-react';
import { Hawk, ViewState, FoodType, FoodPortion } from './types';
import { getHawks, createHawk, deleteHawk, saveEntry } from './services/db';
import { supabase } from './services/supabase';
import { 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-50">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
          <p className="text-slate-500 mb-6">Hubo un error al cargar la aplicación. Intenta recargar la página.</p>
          <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold">
            <RefreshCcw className="w-4 h-4" /> Recargar App
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
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Si usas Supabase real, revisa tu email. Si usas modo local, ya puedes entrar.');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-4">
            <Bird className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">FalconWeight Pro</h2>
          <p className="mt-2 text-slate-500">Gestión profesional de cetrería</p>
        </div>
        <form onSubmit={handleAuth} className="mt-8 space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" placeholder="Email" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" placeholder="Contraseña" />
            </div>
          </div>
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
          <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>
        </form>
        <div className="text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
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
  
  // States para formularios
  const [newHawkName, setNewHawkName] = useState('');
  const [newHawkSpecies, setNewHawkSpecies] = useState('');
  const [newHawkTargetWeight, setNewHawkTargetWeight] = useState<number>(0);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setView('HOME');
        refreshData(session.user.id);
      } else {
        setView('AUTH');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setView('HOME');
        refreshData(session.user.id);
      } else {
        setUser(null);
        setView('AUTH');
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading && view !== 'AUTH') {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin w-10 h-10 text-slate-900" /></div>;
  }

  if (view === 'AUTH') return <AuthScreen />;

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 relative border-x border-slate-100 shadow-xl flex flex-col overflow-hidden">
      {view === 'HOME' && (
        <>
          <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10">
            <h1 className="text-xl font-bold">Mis Halcones</h1>
            <div className="flex gap-2">
              <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
              <button onClick={() => setView('ADD_HAWK')} className="p-2 bg-slate-900 text-white rounded-full"><Plus className="w-5 h-5" /></button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 no-scrollbar">
            {hawks.length === 0 ? (
              <div className="text-center py-20 opacity-50"><Bird className="w-12 h-12 mx-auto mb-2" /><p>Añade tu primer halcón</p></div>
            ) : (
              hawks.map(hawk => (
                <div key={hawk.id} onClick={() => { setSelectedHawk(hawk); setView('HAWK_DETAIL'); }} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center active:scale-95 transition-transform">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center"><Bird className="w-5 h-5" /></div>
                    <div><h3 className="font-bold">{hawk.name}</h3><p className="text-xs text-slate-500">{hawk.species}</p></div>
                  </div>
                  <div className="text-right"><p className="text-xs font-bold text-slate-400 uppercase">Peso</p><p className="font-bold">{hawk.entries[0]?.weightBefore || '--'}g</p></div>
                </div>
              ))
            )}
          </main>
        </>
      )}

      {view === 'ADD_HAWK' && (
        <>
          <header className="p-4 bg-white border-b flex items-center gap-4">
            <button onClick={() => setView('HOME')} className="p-2"><ChevronLeft /></button>
            <h1 className="text-xl font-bold">Nuevo Halcón</h1>
          </header>
          <main className="p-6 space-y-4">
            <input type="text" value={newHawkName} onChange={e => setNewHawkName(e.target.value)} placeholder="Nombre" className="w-full p-4 rounded-xl border border-slate-200 outline-none" />
            <input type="text" value={newHawkSpecies} onChange={e => setNewHawkSpecies(e.target.value)} placeholder="Especie" className="w-full p-4 rounded-xl border border-slate-200 outline-none" />
            <input type="number" value={newHawkTargetWeight || ''} onChange={e => setNewHawkTargetWeight(parseInt(e.target.value))} placeholder="Peso Objetivo (g)" className="w-full p-4 rounded-xl border border-slate-200 outline-none" />
            <button onClick={async () => {
              if (user && newHawkName) {
                await createHawk(newHawkName, newHawkSpecies, newHawkTargetWeight, user.id);
                refreshData(user.id);
                setView('HOME');
              }
            }} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg">Guardar</button>
          </main>
        </>
      )}

      {view === 'HAWK_DETAIL' && selectedHawk && (
        <>
          <header className="p-4 bg-white border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button onClick={() => setView('HOME')} className="p-1"><ChevronLeft /></button>
              <h1 className="text-xl font-bold">{selectedHawk.name}</h1>
            </div>
            <button onClick={async () => { if(confirm('¿Borrar?')) { await deleteHawk(selectedHawk.id); setView('HOME'); refreshData(user.id); } }}><Trash2 className="w-5 h-5 text-slate-400" /></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 text-white p-4 rounded-2xl"><p className="text-[10px] opacity-60 uppercase font-bold">Peso Actual</p><h4 className="text-2xl font-bold">{selectedHawk.entries[0]?.weightBefore || '--'}g</h4></div>
              <div className="bg-white p-4 rounded-2xl border"><p className="text-[10px] text-slate-400 uppercase font-bold">Meta</p><h4 className="text-2xl font-bold">{selectedHawk.targetWeight}g</h4></div>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...selectedHawk.entries].reverse().slice(-7).map(e => ({ name: '', peso: e.weightBefore }))}>
                  <Area type="monotone" dataKey="peso" stroke="#0f172a" strokeWidth={2} fill="#f1f5f9" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2 text-sm"><History className="w-4 h-4" /> Historial</h3>
              {selectedHawk.entries.map(entry => (
                <div key={entry.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-sm">
                  <div className="flex justify-between font-bold mb-2"><span>{new Date(entry.date).toLocaleDateString()}</span><span className="text-emerald-600">+{Math.round(entry.weightAfter - entry.weightBefore)}g</span></div>
                  <div className="flex gap-2 flex-wrap">{entry.foodItems.map((f: any) => (<span key={f.id} className="text-[9px] px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-100 uppercase font-bold">{f.type} • {f.portion}</span>))}</div>
                </div>
              ))}
            </div>
          </main>
          <div className="fixed bottom-6 right-6">
            <button onClick={() => setView('ADD_ENTRY')} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl active:scale-95 transition-transform">
              <Plus className="w-5 h-5" /> <span className="font-bold">Nuevo Peso</span>
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-4 bg-white border-b flex items-center gap-4">
            <button onClick={() => setView('HAWK_DETAIL')} className="p-2"><ChevronLeft /></button>
            <h1 className="text-xl font-bold">Registrar Peso</h1>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-20 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Antes (g)</label><input type="number" value={weightBefore} onChange={e => setWeightBefore(e.target.value)} className="w-full p-4 rounded-xl border text-xl font-bold" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Después (g)</label><input type="number" value={weightAfter} onChange={e => setWeightAfter(e.target.value)} className="w-full p-4 rounded-xl border text-xl font-bold" /></div>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><Utensils className="w-4 h-4" /> Alimentación</h3>
              <div className="bg-white p-4 rounded-2xl border border-dashed border-2 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <select value={selectedFoodType} onChange={e => setSelectedFoodType(e.target.value as FoodType)} className="p-3 border rounded-xl bg-slate-50 text-sm">
                    {Object.values(FoodType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select value={selectedFoodPortion} onChange={e => setSelectedFoodPortion(e.target.value as FoodPortion)} className="p-3 border rounded-xl bg-slate-50 text-sm">
                    {Object.values(FoodPortion).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <button onClick={() => setCurrentFoodItems([...currentFoodItems, { id: crypto.randomUUID(), type: selectedFoodType, portion: selectedFoodPortion, quantity: 1 }])} className="w-full py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">+ Añadir Comida</button>
                <div className="space-y-1">{currentFoodItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 rounded-lg"><span>{item.type} ({item.portion})</span><button onClick={() => setCurrentFoodItems(currentFoodItems.filter(i => i.id !== item.id))}><Trash2 className="w-3 h-3 text-red-500" /></button></div>
                ))}</div>
              </div>
            </div>
          </main>
          <div className="p-4 bg-white border-t sticky bottom-0">
            <button onClick={async () => {
              if (selectedHawk && weightBefore && weightAfter) {
                await saveEntry(selectedHawk.id, parseFloat(weightBefore), parseFloat(weightAfter), currentFoodItems);
                refreshData(user.id);
                const data = await getHawks(user.id);
                setSelectedHawk(data.find(h => h.id === selectedHawk.id) || null);
                setView('HAWK_DETAIL');
                setWeightBefore(''); setWeightAfter(''); setCurrentFoodItems([]);
              }
            }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg">Guardar Registro</button>
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
