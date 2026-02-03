import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Eye, EyeOff, Utensils, Calendar, Target,
  ChevronRight, Info, Activity, Minus
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase, IS_MOCK_MODE } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine
} from 'recharts';

const SPECIES_OPTIONS = ['Peregrino', 'Híbrido', 'Gerifalte', 'Lanario', 'Sacre'];

// Definición de colores por categoría (tonos de rojo y cálidos)
const FOOD_COLORS: Record<FoodCategory, { bg: string, border: string, text: string, hover: string, badge: string }> = {
  'Pollito': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', hover: 'hover:bg-amber-100', badge: 'bg-amber-500' },
  'Paloma': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', hover: 'hover:bg-red-100', badge: 'bg-red-600' },
  'Codorniz': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', hover: 'hover:bg-rose-100', badge: 'bg-rose-500' },
  'Perdiz': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', hover: 'hover:bg-orange-100', badge: 'bg-orange-600' },
  'Pato': { bg: 'bg-red-900/5', border: 'border-red-900/20', text: 'text-red-950', hover: 'hover:bg-red-900/10', badge: 'bg-red-900' }
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawkId, setSelectedHawkId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // New Hawk States
  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');

  // New Entry States
  const [weightBefore, setWeightBefore] = useState('');
  const [currentFoodSelections, setCurrentFoodSelections] = useState<FoodSelection[]>([]);

  const selectedHawk = useMemo(() => 
    hawks.find(h => h.id === selectedHawkId) || null
  , [hawks, selectedHawkId]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        loadData(session.user.id);
        setView('DASHBOARD');
      } else {
        setUser(null);
        setView('AUTH');
        setHawks([]);
      }
      setLoading(false);
      window.dispatchEvent(new CustomEvent('app-ready'));
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId: string) => {
    if (IS_MOCK_MODE) {
      const local = localStorage.getItem(`falcon_db_${userId}`);
      if (local) setHawks(JSON.parse(local));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('hawks')
        .select('*, entries(*)')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const formattedHawks = data.map((h: any) => ({
        ...h,
        targetWeight: h.target_weight,
        entries: (h.entries || []).map((e: any) => ({
          ...e,
          weightBefore: e.weight_before,
          totalFoodWeight: e.total_food_weight,
          foodSelections: e.food_selections || []
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      
      setHawks(formattedHawks);
    } catch (e) {
      console.error("Error loading data:", e);
    }
  };

  const saveDataLocally = (newHawks: Hawk[]) => {
    setHawks(newHawks);
    if (user) localStorage.setItem(`falcon_db_${user.id}`, JSON.stringify(newHawks));
  };

  const handleAuth = async (isLogin: boolean) => {
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      alert(e.message || "Error de autenticación");
      setLoading(false);
    }
  };

  const calculatePrediction = (hawk: Hawk): number | null => {
    if (hawk.entries.length < 2) return null;
    const losses: number[] = [];
    for (let i = 0; i < hawk.entries.length - 1; i++) {
      const dayT = hawk.entries[i+1];
      const dayTplus1 = hawk.entries[i];
      const loss = (dayT.weightBefore + dayT.totalFoodWeight) - dayTplus1.weightBefore;
      if (loss > 0) losses.push(loss);
    }
    if (losses.length === 0) return null;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const month = new Date().getMonth();
    let seasonalFactor = 1.0;
    if ([11, 0, 1].includes(month)) seasonalFactor = 1.15;
    if ([5, 6, 7].includes(month)) seasonalFactor = 0.90;
    const lastEntry = hawk.entries[0];
    const predicted = (lastEntry.weightBefore + lastEntry.totalFoodWeight) - (avgLoss * seasonalFactor);
    return Math.round(predicted);
  };

  const updateFoodQuantity = (category: FoodCategory, portion: FoodPortion, delta: number) => {
    setCurrentFoodSelections(prev => {
      const existingIdx = prev.findIndex(f => f.category === category && f.portion === portion);
      if (existingIdx > -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + delta;
        if (newQty <= 0) {
          updated.splice(existingIdx, 1);
        } else {
          updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
        }
        return updated;
      } else if (delta > 0) {
        return [...prev, { id: Math.random().toString(36).substr(2, 9), category, portion, quantity: delta }];
      }
      return prev;
    });
  };

  const getPortionQuantity = (category: FoodCategory, portion: FoodPortion) => {
    return currentFoodSelections.find(f => f.category === category && f.portion === portion)?.quantity || 0;
  };

  const totalFoodWeight = useMemo(() => {
    return currentFoodSelections.reduce((sum, item) => {
      const weight = FOOD_WEIGHT_MAP[item.category]?.[item.portion] || 0;
      return sum + (weight * item.quantity);
    }, 0);
  }, [currentFoodSelections]);

  const saveEntry = async () => {
    if (!selectedHawkId || !weightBefore || !user) return;
    setLoading(true);
    const newWeight = parseFloat(weightBefore);
    const entryData = {
      id: Math.random().toString(),
      date: new Date().toISOString(),
      weightBefore: newWeight,
      totalFoodWeight,
      foodSelections: currentFoodSelections
    };

    if (IS_MOCK_MODE) {
      const updatedHawks = hawks.map(h => h.id === selectedHawkId ? { ...h, entries: [entryData, ...h.entries] } : h);
      saveDataLocally(updatedHawks);
      setWeightBefore(''); setCurrentFoodSelections([]); setView('HAWK_DETAILS');
      setLoading(false);
      return;
    }

    try {
      await supabase.from('entries').insert([{
        hawk_id: selectedHawkId,
        weight_before: newWeight,
        total_food_weight: totalFoodWeight,
        food_selections: currentFoodSelections,
        date: new Date().toISOString()
      }]);
      await loadData(user.id);
      setWeightBefore(''); setCurrentFoodSelections([]); setView('HAWK_DETAILS');
    } finally {
      setLoading(false);
    }
  };

  const addHawk = async () => {
    if (!hawkName || !hawkTargetWeight || !user) return;
    setLoading(true);
    const targetW = parseFloat(hawkTargetWeight);
    const newHawkId = Math.random().toString(36).substr(2, 9);
    const hawkData: Hawk = { id: newHawkId, name: hawkName, species: hawkSpecies, targetWeight: targetW, entries: [] };
    if (IS_MOCK_MODE) {
      saveDataLocally([...hawks, hawkData]);
      setHawkName(''); setHawkTargetWeight(''); setView('DASHBOARD');
      setLoading(false);
      return;
    }
    try {
      await supabase.from('hawks').insert([{ name: hawkName, species: hawkSpecies, target_weight: targetW, user_id: user.id }]);
      await loadData(user.id);
      setHawkName(''); setHawkTargetWeight(''); setView('DASHBOARD');
    } finally {
      setLoading(false);
    }
  };

  const deleteHawkItem = async (id: string) => {
    if (!user) return;
    setLoading(true);
    if (IS_MOCK_MODE) {
      saveDataLocally(hawks.filter(h => h.id !== id));
      setView('DASHBOARD'); setSelectedHawkId(null);
      setLoading(false);
      return;
    }
    try {
      await supabase.from('hawks').delete().eq('id', id);
      await loadData(user.id);
      setView('DASHBOARD'); setSelectedHawkId(null);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!selectedHawk) return [];
    return [...selectedHawk.entries].reverse().map(e => ({
      fecha: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      peso: e.weightBefore,
      comida: e.totalFoodWeight
    }));
  }, [selectedHawk]);

  const nextDayPrediction = useMemo(() => {
    if (!selectedHawk) return null;
    return calculatePrediction(selectedHawk);
  }, [selectedHawk]);

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white text-slate-900 overflow-hidden md:shadow-2xl md:my-4 md:rounded-[2.5rem] relative border-x border-slate-100 font-inter">
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
          <div className="spinner"></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Sincronizando Halcones...</p>
        </div>
      )}

      {view === 'AUTH' && (
        <div className="flex-1 flex flex-col p-10 justify-center items-center text-center">
          <div className="w-24 h-24 bg-red-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-red-600/40 transform -rotate-6">
            <Bird className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-black mb-1 tracking-tighter uppercase italic">Falcon <span className="text-red-600">PRO</span></h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mb-12">CONTROL YOUR FALCONS</p>
          <div className="w-full max-w-xs space-y-3">
            <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold text-center" />
            <div className="relative">
              <input type={showPassword ? "text" : "password"} placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold text-center" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button onClick={() => handleAuth(true)} className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 text-lg tracking-widest uppercase border-b-4 border-red-800 active:translate-y-1 transition-all">Entrar</button>
          </div>
        </div>
      )}

      {view === 'DASHBOARD' && (
        <>
          <header className="p-8 flex justify-between items-center border-b border-slate-50">
            <div>
              <h2 className="text-2xl font-black tracking-tighter uppercase italic">Mis <span className="text-red-600">Halcones</span></h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Activos • {hawks.length} Unidades</p>
              </div>
            </div>
            <button onClick={() => setView('ADD_HAWK')} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl border-b-4 border-red-800 active:scale-95 transition-all"><Plus size={32}/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            {hawks.map(h => (
              <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="group bg-white border-2 border-slate-50 p-6 rounded-[2.5rem] flex justify-between items-center shadow-sm hover:border-red-600 transition-all cursor-pointer">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-red-600 group-hover:text-white rounded-[1.5rem] flex items-center justify-center transition-all shadow-inner"><Bird size={32}/></div>
                  <div>
                    <h3 className="font-black text-2xl tracking-tighter">{h.name}</h3>
                    <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">{h.species}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black tabular-nums">{h.entries[0]?.weightBefore || '--'}<span className="text-[10px] text-red-600 ml-1">G</span></div>
                  <p className="text-[10px] font-black text-slate-300 uppercase">Último Peso</p>
                </div>
              </div>
            ))}
          </main>
        </>
      )}

      {view === 'HAWK_DETAILS' && selectedHawk && (
        <>
          <header className="p-8 flex justify-between items-center border-b border-slate-50 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
              <div>
                <h2 className="font-black text-2xl uppercase italic tracking-tighter">{selectedHawk.name}</h2>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">CONTROL YOUR FALCONS</p>
              </div>
            </div>
            <button onClick={() => { if(confirm('¿Eliminar registro?')) deleteHawkItem(selectedHawk.id) }} className="w-12 h-12 bg-slate-50 text-slate-200 hover:text-red-600 rounded-2xl flex items-center justify-center transition-colors"><Trash2 size={20}/></button>
          </header>
          
          <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-40">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-600 p-8 rounded-[3rem] text-white shadow-2xl shadow-red-600/20 border-b-8 border-red-800">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Peso Actual</p>
                <p className="text-5xl font-black leading-none">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-sm font-bold ml-1">g</span></p>
              </div>
              <div className="bg-slate-900 p-8 rounded-[3rem] text-white border-b-8 border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Objetivo</p>
                <p className="text-5xl font-black leading-none">{selectedHawk.targetWeight}<span className="text-sm font-bold ml-1">g</span></p>
              </div>
            </div>

            {nextDayPrediction && (
              <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[2.5rem] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm"><Activity size={24}/></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Predicción Mañana</p>
                    <p className="text-2xl font-black tracking-tighter">{nextDayPrediction}g</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[3rem] border-2 border-slate-50 p-6 shadow-sm">
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Gráfico de Pesos</h4>
               <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#cbd5e1'}} />
                    <Tooltip />
                    <Area type="monotone" dataKey="peso" stroke="#dc2626" strokeWidth={4} fill="#dc2626" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Diario de Vuelo</h4>
              {selectedHawk.entries.map(e => (
                <div key={e.id} className="bg-white border-2 border-slate-50 p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xl font-black">{e.weightBefore}g</p>
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{e.totalFoodWeight}g alimento</p>
                  </div>
                  <div className="text-right text-[10px] font-bold text-slate-300 uppercase">
                    {new Date(e.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </main>

          <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-center pointer-events-none">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-2xl shadow-red-600/40 flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto text-lg uppercase tracking-[0.2em] border-b-4 border-red-800 italic">
              <Plus size={24} /> Registrar Pesada
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && (
        <main className="flex-1 flex flex-col p-8 space-y-8 bg-white overflow-y-auto no-scrollbar pb-32">
          <div className="flex items-center justify-between">
            <button onClick={() => setView('HAWK_DETAILS')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Registro de <span className="text-red-600">Sesión</span></h2>
            <div className="w-12"></div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Peso Antes de Comer (g)</p>
            <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000" className="w-full bg-transparent border-none font-black text-center text-8xl outline-none text-slate-900 placeholder:text-slate-100 tabular-nums" autoFocus />
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center px-4 bg-slate-900 p-4 rounded-3xl text-white">
              <div className="flex items-center gap-2">
                <Utensils size={18} className="text-red-500" />
                <h3 className="text-[11px] font-black uppercase tracking-widest">Gramaje Total</h3>
              </div>
              <div className="text-2xl font-black text-red-500">{totalFoodWeight}g</div>
            </div>

            {/* Food Grid con Colores Diferenciados */}
            <div className="space-y-6">
              {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => {
                const config = FOOD_COLORS[cat];
                return (
                  <div key={cat} className={`${config.bg} ${config.border} border-2 p-5 rounded-[2.5rem] space-y-4 shadow-sm`}>
                    <div className="flex items-center gap-2 px-2">
                      <div className={`w-2 h-2 rounded-full ${config.badge}`}></div>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${config.text}`}>{cat}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.keys(FOOD_WEIGHT_MAP[cat]) as FoodPortion[]).map(por => {
                        const qty = getPortionQuantity(cat, por);
                        return (
                          <div key={por} className="relative">
                            <button 
                              onClick={() => updateFoodQuantity(cat, por, 1)}
                              className={`w-full ${config.bg} border-2 ${config.border} ${config.hover} p-4 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 group overflow-hidden`}
                            >
                              <span className={`text-[10px] font-black uppercase opacity-60 ${config.text}`}>{por}</span>
                              <span className={`text-lg font-black ${config.text}`}>{FOOD_WEIGHT_MAP[cat][por]}g</span>
                              
                              {qty > 0 && (
                                <div className={`absolute -top-2 -right-2 w-8 h-8 ${config.badge} text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white animate-in zoom-in duration-300`}>
                                  {qty}
                                </div>
                              )}
                            </button>
                            {qty > 0 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateFoodQuantity(cat, por, -1); }}
                                className="absolute -bottom-2 -left-2 w-7 h-7 bg-white border-2 border-slate-100 text-slate-400 rounded-full flex items-center justify-center shadow-sm active:bg-slate-50"
                              >
                                <Minus size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cesta Detallada */}
            {currentFoodSelections.length > 0 && (
              <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Resumen de Ingesta</p>
                <div className="flex flex-wrap gap-2">
                  {currentFoodSelections.map(f => (
                    <div key={f.id} className="bg-white px-4 py-2 rounded-full border border-slate-200 flex items-center gap-2 shadow-sm">
                      <span className="text-[10px] font-black text-slate-900">{f.quantity}x {f.category} ({f.portion})</span>
                      <button onClick={() => updateFoodQuantity(f.category, f.portion, -f.quantity)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="fixed bottom-8 left-0 right-0 px-8 flex justify-center z-20">
            <button 
              disabled={!weightBefore || currentFoodSelections.length === 0}
              onClick={saveEntry} 
              className="w-full max-sm py-6 bg-red-600 disabled:bg-slate-200 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] border-b-4 border-red-800 transition-all active:translate-y-1 italic text-lg"
            >
              Grabar Datos
            </button>
          </div>
        </main>
      )}

      {view === 'ADD_HAWK' && (
        <main className="p-8 space-y-8 flex-1 flex flex-col bg-white">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Nueva <span className="text-red-600">Unidad</span></h2>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest -mt-4">CONTROL YOUR FALCONS</p>
          <div className="space-y-6">
            <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Nombre" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none" />
            <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none uppercase">
              {SPECIES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Peso de Vuelo (g)" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none text-red-600" />
          </div>
          <button onClick={addHawk} className="w-full py-6 bg-red-600 text-white font-black rounded-[2rem] mt-auto uppercase tracking-widest border-b-4 border-red-800 italic text-lg">Activar Registro</button>
        </main>
      )}
    </div>
  );
};

export default App;