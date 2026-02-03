import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Activity, Calculator, X 
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
        loadData(session.user.id);
        setView('DASHBOARD');
      } else {
        setUser(null);
        setView('AUTH');
        setLoading(false);
      }
      setTimeout(() => window.dispatchEvent(new CustomEvent('app-ready')), 200);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId: string) => {
    if (IS_MOCK_MODE) {
      const local = localStorage.getItem(`falcon_db_${userId}`);
      if (local) setHawks(JSON.parse(local));
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('hawks')
        .select('*, entries(*, food_items(*))')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const formattedHawks = data.map((h: any) => ({
        ...h,
        targetWeight: h.target_weight,
        entries: (h.entries || []).map((e: any) => ({
          ...e,
          weightBefore: e.weight_before,
          totalFoodWeight: e.total_food_weight,
          foodSelections: e.food_items || []
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      
      setHawks(formattedHawks);
    } catch (e) {
      console.error("Error fetching from Supabase", e);
      const local = localStorage.getItem(`falcon_db_${userId}`);
      if (local) setHawks(JSON.parse(local));
    }
    setLoading(false);
  };

  const saveData = async (newHawks: Hawk[]) => {
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
        alert("¡Cuenta creada! Revisa tu email si es necesario o intenta entrar.");
      }
    } catch (e: any) {
      alert(e.message || "Error de autenticación. Verifica tus datos.");
    } finally {
      setLoading(false);
    }
  };

  const addHawk = async () => {
    if (!hawkName || !hawkTargetWeight || !user) return;
    
    const newHawkLocal: Hawk = {
      id: Math.random().toString(36).substr(2, 9),
      name: hawkName,
      species: hawkSpecies || 'Desconocida',
      targetWeight: parseInt(hawkTargetWeight),
      entries: []
    };

    if (!IS_MOCK_MODE) {
      try {
        const { data, error } = await supabase
          .from('hawks')
          .insert([{ 
            name: hawkName, 
            species: hawkSpecies, 
            target_weight: parseInt(hawkTargetWeight),
            user_id: user.id 
          }])
          .select().single();
        if (error) throw error;
        newHawkLocal.id = data.id;
      } catch (e) {
        console.error("Error saving hawk to Supabase", e);
      }
    }

    saveData([...hawks, newHawkLocal]);
    setHawkName('');
    setHawkSpecies('');
    setHawkTargetWeight('');
    setView('DASHBOARD');
  };

  const deleteHawkItem = async (id: string) => {
    if (!confirm('¿Eliminar halcón permanentemente?')) return;
    if (!IS_MOCK_MODE) {
      await supabase.from('hawks').delete().eq('id', id);
    }
    saveData(hawks.filter(h => h.id !== id));
    setView('DASHBOARD');
  };

  const saveEntry = async () => {
    if (!selectedHawkId || !weightBefore || !user) return;
    
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

    if (!IS_MOCK_MODE) {
      try {
        const { data: entryData, error: entryErr } = await supabase
          .from('entries')
          .insert([{
            hawk_id: selectedHawkId,
            weight_before: parseFloat(weightBefore),
            total_food_weight: totalFoodWeight,
            date: newEntry.date
          }]).select().single();
        
        if (entryErr) throw entryErr;

        if (tempSelections.length > 0) {
          const items = tempSelections.map(s => ({
            entry_id: entryData.id,
            category: s.category,
            portion: s.portion,
            quantity: s.quantity
          }));
          await supabase.from('food_items').insert(items);
        }
        newEntry.id = entryData.id;
      } catch (e) {
        console.error("Error saving entry to Supabase", e);
      }
    }

    const updatedHawks = hawks.map(h => h.id === selectedHawkId ? { ...h, entries: [newEntry, ...h.entries] } : h);
    saveData(updatedHawks);
    setWeightBefore('');
    setTempSelections([]);
    setView('HAWK_DETAILS');
  };

  const calculatePrediction = (hawk: Hawk): number | undefined => {
    if (!hawk.entries || hawk.entries.length < 3) return undefined;
    const sorted = [...hawk.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let losses: number[] = [];
    for(let i = 0; i < sorted.length - 1; i++) {
      const loss = (sorted[i].weightBefore + sorted[i].totalFoodWeight) - sorted[i+1].weightBefore;
      if (loss > 0) losses.push(loss);
    }
    if (losses.length === 0) return undefined;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const latest = sorted[sorted.length - 1];
    return Math.round((latest.weightBefore + latest.totalFoodWeight) - avgLoss);
  };

  const chartData = useMemo(() => {
    if (!selectedHawk) return [];
    return [...selectedHawk.entries].reverse().slice(-10).map(e => ({
      fecha: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      peso: e.weightBefore
    }));
  }, [selectedHawk]);

  const prediction = useMemo(() => selectedHawk ? calculatePrediction(selectedHawk) : null, [selectedHawk]);

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto bg-[#020617] text-slate-100 overflow-hidden shadow-2xl">
      {view === 'AUTH' && (
        <div className="flex-1 flex flex-col p-8 justify-center items-center text-center">
          <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
            <Bird className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black mb-1">Falcon Weight <span className="text-emerald-500">PRO</span></h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-10">Gestión de Cetrería</p>
          <div className="w-full space-y-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-emerald-500 transition-all" />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-emerald-500 transition-all" />
            <button onClick={() => handleAuth(true)} className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl active:scale-95 transition-all">ENTRAR</button>
            <button onClick={() => handleAuth(false)} className="w-full py-2 text-slate-500 text-xs font-bold uppercase">Registrarse</button>
          </div>
        </div>
      )}

      {view === 'DASHBOARD' && (
        <>
          <header className="p-6 flex justify-between items-center border-b border-slate-900">
            <div>
              <h2 className="text-xl font-black tracking-tight">Falcon Weight <span className="text-emerald-500">PRO</span></h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase">{hawks.length} Halcones</p>
            </div>
            <button onClick={() => setView('ADD_HAWK')} className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center"><Plus/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {hawks.map(h => (
              <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex justify-between items-center active:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center"><Bird size={20}/></div>
                  <div>
                    <h3 className="font-bold">{h.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase">{h.species}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black">{h.entries[0]?.weightBefore || '--'}<span className="text-[10px] text-emerald-500">g</span></p>
                </div>
              </div>
            ))}
            {hawks.length === 0 && <div className="text-center py-20 text-slate-600 font-bold">No hay halcones. Añade uno arriba.</div>}
          </main>
          <footer className="p-4 border-t border-slate-900 flex justify-center">
            <button onClick={() => supabase.auth.signOut()} className="text-slate-600 font-bold text-xs flex items-center gap-2"><LogOut size={14}/> CERRAR SESIÓN</button>
          </footer>
        </>
      )}

      {view === 'ADD_HAWK' && (
        <>
          <header className="p-6 flex items-center gap-4">
            <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-900 rounded-lg"><ChevronLeft/></button>
            <h2 className="font-black">Nuevo Halcón</h2>
          </header>
          <main className="p-6 space-y-4">
            <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Nombre" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl font-bold" />
            <input value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} placeholder="Especie" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl font-bold" />
            <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Peso Vuelo (g)" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl font-bold text-emerald-500" />
            <button onClick={addHawk} className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl">REGISTRAR</button>
          </main>
        </>
      )}

      {view === 'HAWK_DETAILS' && selectedHawk && (
        <>
          <header className="p-6 flex justify-between items-center border-b border-slate-900">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-900 rounded-lg"><ChevronLeft size={18}/></button>
              <h2 className="font-black text-lg">{selectedHawk.name}</h2>
            </div>
            <button onClick={() => deleteHawkItem(selectedHawk.id)} className="text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-24">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500 p-4 rounded-2xl shadow-lg">
                <p className="text-[10px] font-black text-emerald-900 uppercase">Hoy</p>
                <p className="text-2xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}g</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase">Objetivo</p>
                <p className="text-2xl font-black">{selectedHawk.targetWeight}g</p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border ${prediction ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-900 border-slate-800'} flex items-center gap-3`}>
              <Calculator className={prediction ? 'text-emerald-500' : 'text-slate-600'}/>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase">Predicción Mañana</p>
                <p className="font-black text-lg">{prediction ? `${prediction}g` : 'Mínimo 3 días'}</p>
              </div>
            </div>

            <div className="h-48 bg-slate-900/50 rounded-2xl p-2 border border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="col" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="fecha" hide />
                  <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '8px'}} />
                  <Area type="monotone" dataKey="peso" stroke="#10b981" fill="url(#col)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-500 uppercase ml-2">Historial</p>
              {selectedHawk.entries.map(e => (
                <div key={e.id} className="bg-slate-900/80 p-3 rounded-xl flex justify-between items-center border border-slate-800">
                  <p className="text-xs font-bold">{new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                  <p className="font-black text-emerald-500 text-sm">+{e.totalFoodWeight}g</p>
                  <p className="font-bold text-xs">{e.weightBefore}g</p>
                </div>
              ))}
            </div>
          </main>
          <div className="absolute bottom-6 left-0 right-0 px-6">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full py-4 bg-white text-black font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              <TrendingUp size={18}/> ANOTAR CONTROL
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-6 flex items-center gap-4">
            <button onClick={() => setView('HAWK_DETAILS')} className="p-2 bg-slate-900 rounded-lg"><ChevronLeft/></button>
            <h2 className="font-black">Nuevo Control</h2>
          </header>
          <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Peso Actual</label>
              <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000" className="w-full p-6 bg-slate-900 border border-emerald-500/30 rounded-2xl font-black text-center text-4xl" />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-slate-500 uppercase ml-2">Calculadora de Cebado</p>
                <p className="text-emerald-500 font-black">+{tempSelections.reduce((a,c)=>a+((FOOD_WEIGHT_MAP[c.category][c.portion]||0)*c.quantity),0)}g</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: 'Pollito', portion: 'Con Vitelo', quantity: 1}])} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold">POLLITO C/V (25g)</button>
                <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: 'Pollito', portion: 'Sin Vitelo', quantity: 1}])} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold">POLLITO S/V (20g)</button>
              </div>
              
              {['Paloma', 'Codorniz'].map((cat: any) => (
                <div key={cat} className="grid grid-cols-3 gap-2">
                  <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: cat, portion: 'Pecho', quantity: 1}])} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase">{cat} P (45g)</button>
                  <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: cat, portion: 'Entera', quantity: 1}])} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase">{cat} E</button>
                  <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: cat, portion: 'Pata', quantity: 1}])} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase">{cat} PT</button>
                </div>
              ))}

              <div className="space-y-1">
                {tempSelections.map(s => (
                  <div key={s.id} className="flex justify-between items-center bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                    <span className="text-xs font-bold">{s.category} ({s.portion})</span>
                    <button onClick={() => setTempSelections(tempSelections.filter(x => x.id !== s.id))} className="text-red-500"><X size={14}/></button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={saveEntry} className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl shadow-lg shadow-emerald-500/20">GUARDAR DIARIO</button>
          </main>
        </>
      )}
    </div>
  );
};

export default App;