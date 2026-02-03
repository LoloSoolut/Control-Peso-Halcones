import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  Scale, Utensils, Calendar, Target, 
  TrendingUp, Activity, Smartphone, Info,
  Calculator, ChevronRight, X
} from 'lucide-react';
import { 
  Hawk, AppView, FoodCategory, FoodPortion, 
  FoodSelection, DailyEntry, FOOD_WEIGHT_MAP 
} from './types.ts';
import { supabase, IS_MOCK_MODE } from './services/supabase.ts';
import { 
  ResponsiveContainer, AreaChart, Area, 
  CartesianGrid, XAxis, YAxis, Tooltip 
} from 'recharts';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawkId, setSelectedHawkId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState('');
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');
  
  // Entry Form states
  const [weightBefore, setWeightBefore] = useState('');
  const [tempSelections, setTempSelections] = useState<FoodSelection[]>([]);

  const selectedHawk = useMemo(() => 
    hawks.find(h => h.id === selectedHawkId) || null
  , [hawks, selectedHawkId]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        loadData();
        setView('DASHBOARD');
      } else {
        setUser(null);
        setView('AUTH');
        setLoading(false);
      }
      setTimeout(() => window.dispatchEvent(new CustomEvent('app-ready')), 100);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = () => {
    try {
      const local = localStorage.getItem('falcon_db_v2');
      if (local) setHawks(JSON.parse(local));
    } catch (e) {
      console.error("Error loading data", e);
    }
    setLoading(false);
  };

  const saveData = (newHawks: Hawk[]) => {
    setHawks(newHawks);
    localStorage.setItem('falcon_db_v2', JSON.stringify(newHawks));
  };

  const handleAuth = async (isLogin: boolean) => {
    setLoading(true);
    try {
      if (isLogin) await supabase.auth.signInWithPassword({ email, password });
      else await supabase.auth.signUp({ email, password });
    } catch (e: any) {
      alert(e.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const calculatePrediction = (hawk: Hawk): number | undefined => {
    if (!hawk.entries || hawk.entries.length < 5) return undefined;
    const chronological = [...hawk.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let nightLosses: number[] = [];
    for(let i = 0; i < chronological.length - 1; i++) {
      const fullWeightToday = chronological[i].weightBefore + chronological[i].totalFoodWeight;
      const morningWeightNext = chronological[i+1].weightBefore;
      const loss = fullWeightToday - morningWeightNext;
      if (loss > 0) nightLosses.push(loss);
    }
    if (nightLosses.length === 0) return undefined;
    const avgLoss = nightLosses.reduce((a, b) => a + b, 0) / nightLosses.length;
    const latest = chronological[chronological.length - 1];
    return Math.round((latest.weightBefore + latest.totalFoodWeight) - avgLoss);
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
    setView('DASHBOARD');
  };

  const deleteHawk = (id: string) => {
    if (!confirm('¿Eliminar halcón?')) return;
    saveData(hawks.filter(h => h.id !== id));
    setView('DASHBOARD');
  };

  const addFoodToTemp = (cat: FoodCategory, por: FoodPortion) => {
    const existing = tempSelections.find(s => s.category === cat && s.portion === por);
    if (existing) {
      setTempSelections(tempSelections.map(s => 
        s.id === existing.id ? { ...s, quantity: s.quantity + 1 } : s
      ));
    } else {
      setTempSelections([...tempSelections, {
        id: Math.random().toString(),
        category: cat,
        portion: por,
        quantity: 1
      }]);
    }
  };

  const saveEntry = () => {
    if (!selectedHawkId || !weightBefore || isNaN(parseFloat(weightBefore))) return;
    const totalFoodWeight = tempSelections.reduce((acc, curr) => {
      const w = FOOD_WEIGHT_MAP[curr.category][curr.portion] || 0;
      return acc + (w * curr.quantity);
    }, 0);
    const newEntry: DailyEntry = {
      id: Math.random().toString(),
      date: new Date().toISOString(),
      weightBefore: parseFloat(weightBefore),
      totalFoodWeight,
      foodSelections: [...tempSelections]
    };
    const updatedHawks = hawks.map(h => h.id === selectedHawkId ? { ...h, entries: [newEntry, ...h.entries] } : h);
    saveData(updatedHawks);
    setWeightBefore('');
    setTempSelections([]);
    setView('HAWK_DETAILS');
  };

  const chartData = useMemo(() => {
    if (!selectedHawk || !selectedHawk.entries) return [];
    return [...selectedHawk.entries].reverse().slice(-15).map(e => ({
      fecha: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      ayunas: e.weightBefore,
      comida: e.totalFoodWeight,
      total: e.weightBefore + e.totalFoodWeight
    }));
  }, [selectedHawk]);

  const prediction = useMemo(() => selectedHawk ? calculatePrediction(selectedHawk) : null, [selectedHawk]);

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto bg-[#020617] relative overflow-hidden text-slate-100 shadow-2xl">
      {/* AUTH VIEW */}
      {view === 'AUTH' && (
        <div className="flex-1 flex flex-col p-8 justify-center items-center text-center">
          <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)] mb-8 rotate-3">
            <Bird className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-1">Falcon Weight<span className="text-emerald-500 ml-2 px-2 py-1 bg-emerald-500/10 rounded-lg text-lg">PRO</span></h1>
          <p className="text-slate-500 font-medium mb-12 text-sm uppercase tracking-widest">Especialistas en Cetrería</p>
          
          <div className="w-full space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl outline-none focus:border-emerald-500 transition-all font-medium" />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl outline-none focus:border-emerald-500 transition-all font-medium" />
            <button onClick={() => handleAuth(true)} className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-wider">ENTRAR</button>
            <button onClick={() => handleAuth(false)} className="w-full py-2 text-slate-500 font-bold text-xs uppercase tracking-widest">Crear cuenta</button>
          </div>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {view === 'DASHBOARD' && (
        <>
          <header className="p-6 pb-2 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Falcon Weight <span className="text-emerald-500">PRO</span></h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{hawks.length} Halcones en Cámara</p>
            </div>
            <button onClick={() => setView('ADD_HAWK')} className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-90 transition-all">
              <Plus className="w-6 h-6 text-white" />
            </button>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {hawks.map(h => (
              <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl flex items-center justify-between group active:bg-slate-800 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-active:bg-emerald-500 group-active:text-white transition-all">
                    <Bird className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{h.name}</h3>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-tighter">{h.species}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-600 uppercase">Último</p>
                  <p className="text-xl font-black">{h.entries && h.entries[0] ? h.entries[0].weightBefore : '--'}<span className="text-sm ml-1 text-emerald-500/50">g</span></p>
                </div>
              </div>
            ))}
            {hawks.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-700">
                <Bird className="w-16 h-16 opacity-10 mb-4" />
                <p className="font-bold">No hay halcones registrados</p>
              </div>
            )}
          </main>

          <nav className="p-6 bg-[#020617] border-t border-slate-900 flex justify-between items-center">
            <button onClick={() => setView('DASHBOARD')} className="flex flex-col items-center gap-1 text-emerald-500">
              <Activity className="w-6 h-6" />
              <span className="text-[10px] font-black">PANEL</span>
            </button>
            <button onClick={() => supabase.auth.signOut()} className="flex flex-col items-center gap-1 text-slate-600">
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-black">SALIR</span>
            </button>
          </nav>
        </>
      )}

      {/* ADD HAWK VIEW */}
      {view === 'ADD_HAWK' && (
        <>
          <header className="p-6 border-b border-slate-900 flex items-center gap-4">
            <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-900 rounded-xl"><ChevronLeft /></button>
            <h2 className="text-xl font-black">Nuevo Ejemplar</h2>
          </header>
          <main className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase ml-2">Nombre del Halcón</label>
                <input value={hawkName} onChange={e => setHawkName(e.target.value)} type="text" placeholder="Ej: Rayo" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase ml-2">Especie / Híbrido</label>
                <input value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} type="text" placeholder="Ej: Gerifalte x Peregrino" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase ml-2">Peso de Vuelo (Target)</label>
                <div className="relative">
                  <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Peso en gramos" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl font-bold text-emerald-500" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-700">G</span>
                </div>
              </div>
            </div>
            <button onClick={addHawk} className="w-full py-5 bg-emerald-500 text-white font-black rounded-3xl shadow-xl active:scale-95 transition-all uppercase tracking-widest">Añadir a Falcon Weight PRO</button>
          </main>
        </>
      )}

      {/* HAWK DETAILS VIEW */}
      {view === 'HAWK_DETAILS' && selectedHawk && (
        <>
          <header className="p-6 border-b border-slate-900 flex items-center justify-between bg-[#020617]/80 backdrop-blur sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-900 rounded-xl"><ChevronLeft className="w-5 h-5" /></button>
              <h2 className="text-xl font-black">{selectedHawk.name}</h2>
            </div>
            <button onClick={() => deleteHawk(selectedHawk.id)} className="p-2 text-slate-700 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-28 no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500 p-5 rounded-3xl shadow-lg relative overflow-hidden">
                <p className="text-[10px] font-black text-emerald-900 uppercase mb-1">Último Peso</p>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-4xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}</span>
                  <span className="text-sm font-bold opacity-60">g</span>
                </div>
                <Activity className="absolute bottom-2 right-2 w-12 h-12 text-white opacity-10" />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Peso Vuelo</p>
                <div className="flex items-baseline gap-1 text-slate-100">
                  <span className="text-4xl font-black">{selectedHawk.targetWeight}</span>
                  <span className="text-sm font-bold text-slate-600">g</span>
                </div>
              </div>
            </div>

            <div className={`p-5 rounded-3xl flex items-center gap-4 border transition-all ${prediction ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-900/30 border-slate-800'}`}>
              <div className={`p-3 rounded-2xl ${prediction ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Predicción Metabólica</p>
                <p className="text-xl font-black">{prediction ? `${prediction}g` : 'Calculando...'}</p>
                {!prediction && <p className="text-[9px] font-bold text-slate-600 uppercase">Faltan {5 - selectedHawk.entries.length} días de datos</p>}
              </div>
            </div>

            <div className="h-56 bg-slate-900/50 border border-slate-800 rounded-3xl p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAyunas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#475569', fontWeight: 'bold'}} />
                  <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px'}} />
                  <Area type="monotone" dataKey="ayunas" name="Ayunas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAyunas)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 pb-8">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Historial Diario</h4>
              {selectedHawk.entries.map(e => (
                <div key={e.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm capitalize">{new Date(e.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{e.foodSelections.reduce((a,c)=>a+c.quantity,0)} piezas de alimento</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-500">+{e.totalFoodWeight}g</p>
                    <p className="text-xs font-bold text-slate-400">{e.weightBefore}g ayunas</p>
                  </div>
                </div>
              ))}
            </div>
          </main>

          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full py-5 bg-white text-black font-black rounded-3xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> REGISTRAR CONTROL
            </button>
          </div>
        </>
      )}

      {/* ADD ENTRY VIEW (CALCULATOR) */}
      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-6 border-b border-slate-900 flex items-center gap-4 bg-[#020617] sticky top-0 z-20">
            <button onClick={() => setView('HAWK_DETAILS')} className="p-2 bg-slate-900 rounded-xl"><ChevronLeft /></button>
            <h2 className="text-xl font-black">Nuevo Registro</h2>
          </header>
          <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
            <div className="space-y-4 text-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peso Actual (Gramos)</label>
              <div className="relative">
                <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000" className="w-full p-6 bg-slate-900 border border-emerald-500/30 rounded-3xl font-black text-center text-5xl focus:border-emerald-500 outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alimentación</h4>
                <div className="bg-emerald-500/10 text-emerald-500 px-4 py-1 rounded-full text-xl font-black">+{tempSelections.reduce((a,c)=>a+((FOOD_WEIGHT_MAP[c.category][c.portion]||0)*c.quantity),0)}<span className="text-xs ml-1">g</span></div>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-600 uppercase ml-2">Pollitos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addFoodToTemp('Pollito', 'Con Vitelo')} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold active:bg-emerald-500 transition-all">C. Vitelo (25g)</button>
                    <button onClick={() => addFoodToTemp('Pollito', 'Sin Vitelo')} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold active:bg-emerald-500 transition-all">S. Vitelo (20g)</button>
                  </div>
                </div>

                {['Paloma', 'Codorniz', 'Pato', 'Perdiz'].map((cat: any) => (
                  <div key={cat} className="space-y-2">
                    <p className="text-[10px] font-black text-slate-600 uppercase ml-2">{cat}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => addFoodToTemp(cat, 'Pecho')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black active:bg-emerald-500 transition-all">PECHO</button>
                      <button onClick={() => addFoodToTemp(cat, 'Pata')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black active:bg-emerald-500 transition-all">PATA</button>
                      <button onClick={() => addFoodToTemp(cat, 'Entera')} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black active:bg-emerald-500 transition-all uppercase tracking-tighter">ENTERA</button>
                    </div>
                  </div>
                ))}
              </div>

              {tempSelections.length > 0 && (
                <div className="mt-6 space-y-2 bg-slate-900/50 p-5 rounded-3xl border border-emerald-500/20">
                  {tempSelections.map(s => (
                    <div key={s.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-xs font-black">{s.quantity}x</span>
                        <div>
                          <p className="text-xs font-black">{s.category}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">{s.portion}</p>
                        </div>
                      </div>
                      <button onClick={() => setTempSelections(tempSelections.filter(x => x.id !== s.id))} className="text-slate-600 p-1"><X size={14}/></button>
                    </div>
                  ))}
                  <button onClick={() => setTempSelections([])} className="w-full pt-2 text-[9px] font-black text-red-500/50 uppercase tracking-widest">Vaciar Cesta</button>
                </div>
              )}
            </div>
            
            <button onClick={saveEntry} className="w-full py-5 bg-emerald-500 text-white font-black rounded-3xl shadow-xl active:scale-95 transition-all uppercase tracking-widest">Guardar en Diario</button>
          </main>
        </>
      )}
    </div>
  );
};

export default App;