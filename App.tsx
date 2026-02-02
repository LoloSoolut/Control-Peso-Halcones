import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  Scale, Utensils, Calendar, Target, 
  Smartphone, ShieldCheck, Mail, Lock, 
  Loader2, AlertCircle, TrendingUp
} from 'lucide-react';
import { Hawk, ViewState, FoodType, FoodPortion, DailyEntry, FoodItem } from './types.ts';
import { supabase, IS_MOCK_MODE } from './services/supabase.ts';
import { 
  ResponsiveContainer, AreaChart, Area, 
  CartesianGrid, XAxis, YAxis, Tooltip 
} from 'recharts';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawk, setSelectedHawk] = useState<Hawk | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState('');
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');
  const [wBefore, setWBefore] = useState('');
  const [wAfter, setWAfter] = useState('');
  const [currentFood, setCurrentFood] = useState<FoodItem[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setView('HOME');
        loadData();
      } else {
        setUser(null);
        setView('AUTH');
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // En modo real aquí irían los selects complejos
      const localHawks = JSON.parse(localStorage.getItem('db_hawks') || '[]');
      setHawks(localHawks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveData = (newHawks: Hawk[]) => {
    setHawks(newHawks);
    localStorage.setItem('db_hawks', JSON.stringify(newHawks));
  };

  const handleAuth = async (isLogin: boolean) => {
    setLoading(true);
    try {
      if (isLogin) await supabase.auth.signInWithPassword({ email, password });
      else await supabase.auth.signUp({ email, password });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addHawk = () => {
    if (!hawkName || !hawkTargetWeight) return;
    const newHawk: Hawk = {
      id: Math.random().toString(36).substr(2, 9),
      name: hawkName,
      species: hawkSpecies || 'Desconocida',
      targetWeight: parseInt(hawkTargetWeight),
      entries: []
    };
    saveData([...hawks, newHawk]);
    setHawkName('');
    setHawkSpecies('');
    setHawkTargetWeight('');
    setView('HOME');
  };

  const deleteHawk = (id: string) => {
    if (!confirm('¿Eliminar este halcón y todos sus registros?')) return;
    saveData(hawks.filter(h => h.id !== id));
    setView('HOME');
  };

  const addEntry = () => {
    if (!selectedHawk || !wBefore || !wAfter) return;
    const entry: DailyEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      weightBefore: parseFloat(wBefore),
      weightAfter: parseFloat(wAfter),
      foodItems: [...currentFood]
    };
    
    const updatedHawks = hawks.map(h => {
      if (h.id === selectedHawk.id) {
        const updatedEntries = [entry, ...h.entries];
        const updatedHawk = { ...h, entries: updatedEntries };
        setSelectedHawk(updatedHawk);
        return updatedHawk;
      }
      return h;
    });
    
    saveData(updatedHawks);
    setWBefore('');
    setWAfter('');
    setCurrentFood([]);
    setView('HAWK_DETAIL');
  };

  const chartData = useMemo(() => {
    if (!selectedHawk) return [];
    return [...selectedHawk.entries]
      .reverse()
      .slice(-7)
      .map(e => ({
        fecha: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        peso: e.weightBefore
      }));
  }, [selectedHawk]);

  if (loading && view !== 'AUTH') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-slate-900 mb-4" />
        <p className="font-bold text-slate-400">Sincronizando...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden">
      {/* AUTH VIEW */}
      {view === 'AUTH' && (
        <div className="flex-1 flex flex-col p-8 justify-center bg-slate-50">
          <div className="mb-12 text-center">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl rotate-3">
              <Bird className="w-12 h-12" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">FalconWeight</h1>
            <p className="text-slate-500 mt-2 font-medium">Gestión profesional de cetrería</p>
            {IS_MOCK_MODE && (
              <span className="mt-4 inline-block px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full border border-amber-200">
                Modo Local Activado
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="email" placeholder="Tu Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all" />
            </div>
            <button onClick={() => handleAuth(true)} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform">Entrar</button>
            <button onClick={() => handleAuth(false)} className="w-full py-2 text-slate-500 font-bold text-sm">Crear nueva cuenta</button>
          </div>
        </div>
      )}

      {/* HOME VIEW */}
      {view === 'HOME' && (
        <>
          <header className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-2xl font-black flex items-center gap-2">
                Mis Halcones 
                {IS_MOCK_MODE ? <Smartphone className="w-4 h-4 text-amber-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{hawks.length} Registrados</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
              <button onClick={() => setView('ADD_HAWK')} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg active:scale-90 transition-transform"><Plus className="w-6 h-6" /></button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {hawks.length === 0 ? (
              <div className="text-center py-20 opacity-30 flex flex-col items-center">
                <Bird className="w-16 h-16 mb-4" />
                <p className="font-bold">Añade tu primer halcón para empezar</p>
              </div>
            ) : (
              hawks.map(h => (
                <div key={h.id} onClick={() => { setSelectedHawk(h); setView('HAWK_DETAIL'); }} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900">
                      <Bird className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{h.name}</h3>
                      <p className="text-xs font-semibold text-slate-400">{h.species}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase">Último Peso</p>
                    <p className="text-xl font-black">{h.entries[0]?.weightBefore || '--'}<span className="text-sm ml-1 text-slate-400">g</span></p>
                  </div>
                </div>
              ))
            )}
          </main>
        </>
      )}

      {/* ADD HAWK VIEW */}
      {view === 'ADD_HAWK' && (
        <>
          <header className="p-6 border-b flex items-center gap-4">
            <button onClick={() => setView('HOME')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-xl font-black">Nuevo Halcón</h2>
          </header>
          <main className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-2">Identificación</label>
              <input type="text" placeholder="Nombre (ej: Zeus)" value={hawkName} onChange={e => setHawkName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              <input type="text" placeholder="Especie (ej: Falco peregrinus)" value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase ml-2">Objetivo</label>
              <div className="relative">
                <Scale className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input type="number" placeholder="Peso de vuelo meta (g)" value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              </div>
            </div>
            <button onClick={addHawk} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl mt-4">Registrar Halcón</button>
          </main>
        </>
      )}

      {/* HAWK DETAIL VIEW */}
      {view === 'HAWK_DETAIL' && selectedHawk && (
        <>
          <header className="p-6 border-b flex items-center justify-between bg-white z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('HOME')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-5 h-5" /></button>
              <h2 className="text-xl font-black">{selectedHawk.name}</h2>
            </div>
            <button onClick={() => deleteHawk(selectedHawk.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10" />
                <p className="text-[10px] font-black opacity-60 mb-1">PESO ACTUAL</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}</span>
                  <span className="text-sm font-bold opacity-60">g</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-400 mb-1">PESO META</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">{selectedHawk.targetWeight}</span>
                  <span className="text-sm font-bold text-slate-400">g</span>
                </div>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Area type="monotone" dataKey="peso" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorPeso)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Historial Reciente
              </h4>
              {selectedHawk.entries.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 text-slate-400 text-sm font-bold">
                  Sin registros hoy
                </div>
              ) : (
                selectedHawk.entries.slice(0, 10).map(e => (
                  <div key={e.id} className="bg-white p-4 rounded-2xl border border-slate-50 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm capitalize">{new Date(e.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                      <div className="flex gap-2 mt-1">
                        {e.foodItems.map((f, idx) => (
                          <span key={idx} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                            {f.type} ({f.portion})
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">{e.weightBefore}g → {e.weightAfter}g</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
              <TrendingUp className="w-5 h-5" /> ANOTAR PESO HOY
            </button>
          </div>
        </>
      )}

      {/* ADD ENTRY VIEW */}
      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-6 border-b flex items-center gap-4">
            <button onClick={() => setView('HAWK_DETAIL')} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-xl font-black">Registro de {selectedHawk.name}</h2>
          </header>
          <main className="p-6 space-y-6 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Peso Ayunas</label>
                <div className="relative">
                  <input type="number" placeholder="Antes" value={wBefore} onChange={e => setWBefore(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center text-2xl" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">g</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Peso Tras Cebar</label>
                <div className="relative">
                  <input type="number" placeholder="Después" value={wAfter} onChange={e => setWAfter(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center text-2xl" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">g</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
              <h4 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2 mb-2">
                <Utensils className="w-3 h-3" /> Composición Comida
              </h4>
              
              <div className="flex flex-wrap gap-2">
                {Object.values(FoodType).map(type => (
                  <button key={type} onClick={() => {
                    const existing = currentFood.find(f => f.type === type);
                    if (existing) {
                      setCurrentFood(currentFood.filter(f => f.type !== type));
                    } else {
                      setCurrentFood([...currentFood, { id: Math.random().toString(), type, portion: FoodPortion.ENTERO, quantity: 1 }]);
                    }
                  }} className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${currentFood.find(f => f.type === type) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                    {type}
                  </button>
                ))}
              </div>

              {currentFood.length > 0 && (
                <div className="mt-4 space-y-2">
                  {currentFood.map(item => (
                    <div key={item.id} className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-100">
                      <span className="text-xs font-black text-slate-900 flex-1">{item.type}</span>
                      <select value={item.portion} onChange={e => {
                        setCurrentFood(currentFood.map(f => f.id === item.id ? { ...f, portion: e.target.value as FoodPortion } : f));
                      }} className="bg-slate-50 text-[10px] font-bold p-1 rounded-lg border-none outline-none">
                        {Object.values(FoodPortion).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <button onClick={() => setCurrentFood(currentFood.filter(f => f.id !== item.id))} className="text-red-400 p-1"><Plus className="w-4 h-4 rotate-45" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={addEntry} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl mt-4 active:scale-95 transition-all">Guardar Registro</button>
          </main>
        </>
      )}
    </div>
  );
};

export default App;