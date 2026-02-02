
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
  User,
  Lock,
  Mail,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Hawk, ViewState, FoodType, FoodPortion, FoodEntry } from './types';
import { getHawks, createHawk, deleteHawk, saveEntry } from './services/db';
import { supabase } from './services/supabase';
import { 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Auth Component ---

const AuthScreen: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
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
        if (!supabase.auth.getSession()) {
          alert('Revisa tu email para confirmar el registro');
        }
      }
      onAuth();
    } catch (err: any) {
      setError(err.message || 'Error de conexión. Verifica tus credenciales.');
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
          <div className="space-y-4 rounded-md shadow-sm">
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                placeholder="Email"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                placeholder="Contraseña"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const Header: React.FC<{ title: string; onBack?: () => void; actions?: React.ReactNode }> = ({ title, onBack, actions }) => (
  <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
      )}
      <h1 className="text-xl font-bold text-slate-900 truncate">{title}</h1>
    </div>
    <div className="flex items-center gap-2">{actions}</div>
  </header>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>{children}</div>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawk, setSelectedHawk] = useState<Hawk | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);
  
  // Form States
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
      setSyncError(false);
      const data = await getHawks(userId);
      setHawks(data);
    } catch (err) {
      console.error("Fetch error:", err);
      setSyncError(true);
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
          refreshData(session.user.id);
        } else {
          setView('AUTH');
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth init error:", err);
        setView('AUTH');
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

  const handleAddHawk = async () => {
    if (!newHawkName || !user) return;
    const hawk = await createHawk(newHawkName, newHawkSpecies, newHawkTargetWeight, user.id);
    if (hawk) {
      await refreshData(user.id);
      setView('HOME');
      setNewHawkName('');
      setNewHawkSpecies('');
      setNewHawkTargetWeight(0);
    }
  };

  const handleAddFoodItem = () => {
    setCurrentFoodItems([...currentFoodItems, {
      id: crypto.randomUUID(),
      type: selectedFoodType,
      portion: selectedFoodPortion,
      quantity: 1
    }]);
  };

  const handleSaveEntry = async () => {
    if (!selectedHawk || !weightBefore || !weightAfter) return;
    const success = await saveEntry(
      selectedHawk.id,
      parseFloat(weightBefore),
      parseFloat(weightAfter),
      currentFoodItems
    );

    if (success && user) {
      const data = await getHawks(user.id);
      setHawks(data);
      const updated = data.find(h => h.id === selectedHawk.id);
      if (updated) setSelectedHawk(updated);
      setView('HAWK_DETAIL');
      setWeightBefore('');
      setWeightAfter('');
      setCurrentFoodItems([]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading && view !== 'AUTH') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin w-10 h-10 text-slate-900" />
          <p className="text-slate-500 font-medium">Sincronizando datos...</p>
        </div>
      </div>
    );
  }

  if (view === 'AUTH') return <AuthScreen onAuth={() => {}} />;

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 relative border-x border-slate-100 shadow-xl overflow-hidden">
      {syncError && (
        <div className="bg-amber-500 text-white text-[10px] text-center py-1 uppercase font-bold tracking-widest animate-pulse">
          Error de conexión - Modo lectura/local
        </div>
      )}
      
      {view === 'HOME' && (
        <div className="flex flex-col h-screen">
          <Header 
            title="Mis Halcones" 
            actions={
              <div className="flex gap-2">
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
                <button onClick={() => setView('ADD_HAWK')} className="p-2 bg-slate-900 text-white rounded-full active:scale-90 transition-transform"><Plus className="w-6 h-6" /></button>
              </div>
            }
          />
          <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 no-scrollbar">
            {hawks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
                <Bird className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-slate-500">No tienes halcones registrados.</p>
                <button onClick={() => setView('ADD_HAWK')} className="mt-2 text-slate-900 font-bold underline">Añadir uno ahora</button>
              </div>
            ) : (
              hawks.map(hawk => (
                <Card key={hawk.id} className="hover:border-slate-300 transition-colors active:scale-[0.98]">
                  <button onClick={() => { setSelectedHawk(hawk); setView('HAWK_DETAIL'); }} className="w-full text-left p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600"><Bird className="w-6 h-6" /></div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{hawk.name}</h3>
                        <p className="text-sm text-slate-500">{hawk.species || 'Especie no definida'}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Último Peso</span>
                      <p className="font-bold text-slate-900 text-lg">{hawk.entries[0]?.weightBefore || '--'}g</p>
                    </div>
                  </button>
                </Card>
              ))
            )}
          </main>
        </div>
      )}

      {view === 'ADD_HAWK' && (
        <div className="flex flex-col h-screen">
          <Header title="Añadir Halcón" onBack={() => setView('HOME')} />
          <main className="flex-1 p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nombre</label>
                <input type="text" value={newHawkName} onChange={(e) => setNewHawkName(e.target.value)} placeholder="Ej: Rayo" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Especie</label>
                <input type="text" value={newHawkSpecies} onChange={(e) => setNewHawkSpecies(e.target.value)} placeholder="Ej: Peregrino" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Peso Objetivo (g)</label>
                <input type="number" value={newHawkTargetWeight || ''} onChange={(e) => setNewHawkTargetWeight(parseInt(e.target.value))} placeholder="Ej: 900" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
            </div>
            <button onClick={handleAddHawk} disabled={!newHawkName} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 disabled:opacity-50 transition-all">Guardar Halcón</button>
          </main>
        </div>
      )}

      {view === 'HAWK_DETAIL' && selectedHawk && (
        <div className="flex flex-col h-screen">
          <Header title={selectedHawk.name} onBack={() => setView('HOME')} actions={<button onClick={async () => { if(confirm('¿Borrar?')) { await deleteHawk(selectedHawk.id); setView('HOME'); refreshData(user.id); } }}><Trash2 className="w-5 h-5 text-slate-400" /></button>} />
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-slate-900 text-white border-none shadow-slate-200"><p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Peso Actual</p><h4 className="text-2xl font-bold">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-sm font-normal text-slate-400 ml-1">g</span></h4></Card>
              <Card className="p-4"><p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Objetivo</p><h4 className="text-2xl font-bold">{selectedHawk.targetWeight}<span className="text-sm font-normal text-slate-400 ml-1">g</span></h4></Card>
            </div>
            
            <Card className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-800">Tendencia semanal</h3>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="h-40">
                {selectedHawk.entries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...selectedHawk.entries].reverse().slice(-7).map(e => ({ name: new Date(e.date).toLocaleDateString('es-ES', { weekday: 'short' }), peso: e.weightBefore }))}>
                      <defs>
                        <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="peso" stroke="#0f172a" strokeWidth={2} fill="url(#colorPeso)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">Aún no hay suficientes datos</div>
                )}
              </div>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><History className="w-4 h-4" /> Historial</h3>
              {selectedHawk.entries.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm italic">Sin registros diarios</p>
              ) : (
                selectedHawk.entries.map(entry => (
                  <Card key={entry.id} className="p-4 bg-white border-slate-100">
                    <div className="flex justify-between text-[11px] font-bold mb-3 border-b border-slate-50 pb-2">
                      <span className="text-slate-800">{new Date(entry.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span>
                      <span className="text-emerald-600">Aumentó {Math.round(entry.weightAfter - entry.weightBefore)}g</span>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex-1"><p className="text-[10px] text-slate-400 uppercase font-bold">Ayunas</p><p className="font-bold text-slate-700">{entry.weightBefore}g</p></div>
                      <div className="flex-1 text-right"><p className="text-[10px] text-slate-400 uppercase font-bold">Post-comida</p><p className="font-bold text-slate-700">{entry.weightAfter}g</p></div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {entry.foodItems.length > 0 ? entry.foodItems.map((f: any) => (
                        <span key={f.id} className="text-[9px] px-2 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-100 uppercase font-bold">{f.type} • {f.portion}</span>
                      )) : <span className="text-[9px] text-slate-300 italic">No se registró comida</span>}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </main>
          <div className="fixed bottom-6 right-6">
            <button onClick={() => setView('ADD_ENTRY')} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-slate-400 active:scale-95 transition-all">
              <Plus className="w-6 h-6" />
              <span className="font-bold">Nuevo Peso</span>
            </button>
          </div>
        </div>
      )}

      {view === 'ADD_ENTRY' && (
        <div className="flex flex-col h-screen">
          <Header title="Registro de Peso" onBack={() => setView('HAWK_DETAIL')} />
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 no-scrollbar">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Scale className="w-4 h-4" /> Control de Peso</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Peso en ayunas</label>
                  <input type="number" inputMode="decimal" value={weightBefore} onChange={e => setWeightBefore(e.target.value)} placeholder="0.0" className="w-full p-4 rounded-xl border border-slate-200 text-xl font-bold outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Peso saciado</label>
                  <input type="number" inputMode="decimal" value={weightAfter} onChange={e => setWeightAfter(e.target.value)} placeholder="0.0" className="w-full p-4 rounded-xl border border-slate-200 text-xl font-bold outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Utensils className="w-4 h-4" /> Alimentación</h3>
              <Card className="p-4 space-y-4 border-dashed border-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={selectedFoodType} onChange={e => setSelectedFoodType(e.target.value as FoodType)} className="p-3 border rounded-xl bg-slate-50 font-medium text-sm outline-none">
                    {Object.values(FoodType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select value={selectedFoodPortion} onChange={e => setSelectedFoodPortion(e.target.value as FoodPortion)} className="p-3 border rounded-xl bg-slate-50 font-medium text-sm outline-none">
                    {Object.values(FoodPortion).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <button onClick={handleAddFoodItem} className="w-full py-3 bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-200 text-xs hover:bg-slate-100 transition-colors">+ Añadir Pieza de Comida</button>
                <div className="space-y-2">
                  {currentFoodItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-800">{item.type}</span>
                        <span className="text-amber-600">({item.portion})</span>
                      </div>
                      <button onClick={() => setCurrentFoodItems(currentFoodItems.filter(i => i.id !== item.id))} className="p-1 hover:bg-amber-100 rounded-lg text-amber-900 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </main>
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-50">
            <button 
              onClick={handleSaveEntry} 
              disabled={!weightBefore || !weightAfter}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl active:scale-95 disabled:opacity-50 transition-all"
            >
              Guardar Registro Diario
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
