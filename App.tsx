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
          foodSelections: (e.food_items || []).map((fi: any) => ({
            id: fi.id,
            category: fi.category as FoodCategory,
            portion: fi.portion as FoodPortion,
            quantity: fi.quantity
          }))
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
      alert(e.message || "Error al procesar solicitud");
      setLoading(false);
    }
  };

  const addHawk = async () => {
    if (!hawkName || !hawkTargetWeight || !user) return;
    setLoading(true);
    
    if (IS_MOCK_MODE) {
      const newHawk: Hawk = {
        id: Math.random().toString(36).substr(2, 9),
        name: hawkName,
        species: hawkSpecies || 'Desconocida',
        targetWeight: parseInt(hawkTargetWeight),
        entries: []
      };
      saveDataLocally([...hawks, newHawk]);
      setHawkName(''); setHawkSpecies(''); setHawkTargetWeight('');
      setView('DASHBOARD');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('hawks')
        .insert([{ 
          name: hawkName, 
          species: hawkSpecies, 
          target_weight: parseInt(hawkTargetWeight),
          user_id: user.id 
        }]);
      
      if (error) throw error;
      await loadData(user.id);
      setHawkName(''); setHawkSpecies(''); setHawkTargetWeight('');
      setView('DASHBOARD');
    } catch (e) {
      alert("Error al guardar halcón");
    } finally {
      setLoading(false);
    }
  };

  const deleteHawkItem = async (id: string) => {
    if (!confirm('¿Eliminar este halcón permanentemente?')) return;
    if (IS_MOCK_MODE) {
      saveDataLocally(hawks.filter(h => h.id !== id));
      setView('DASHBOARD');
      return;
    }
    await supabase.from('hawks').delete().eq('id', id);
    await loadData(user.id);
    setView('DASHBOARD');
  };

  const saveEntry = async () => {
    if (!selectedHawkId || !weightBefore || !user) return;
    setLoading(true);
    
    const totalFoodWeight = tempSelections.reduce((acc, curr) => {
      const w = FOOD_WEIGHT_MAP[curr.category][curr.portion] || 0;
      return acc + (w * curr.quantity);
    }, 0);

    if (IS_MOCK_MODE) {
      const newEntry: DailyEntry = {
        id: Math.random().toString(),
        date: new Date().toISOString(),
        weightBefore: parseFloat(weightBefore),
        totalFoodWeight,
        foodSelections: [...tempSelections]
      };
      const updatedHawks = hawks.map(h => h.id === selectedHawkId ? { ...h, entries: [newEntry, ...h.entries] } : h);
      saveDataLocally(updatedHawks);
      setWeightBefore(''); setTempSelections([]); setView('HAWK_DETAILS');
      setLoading(false);
      return;
    }

    try {
      const { data: entryData, error: entryErr } = await supabase
        .from('entries')
        .insert([{
          hawk_id: selectedHawkId,
          weight_before: parseFloat(weightBefore),
          total_food_weight: totalFoodWeight,
          date: new Date().toISOString()
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
      
      await loadData(user.id);
      setWeightBefore(''); setTempSelections([]); setView('HAWK_DETAILS');
    } catch (e) {
      alert("Error al guardar el peso");
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!selectedHawk) return [];
    return [...selectedHawk.entries].reverse().slice(-7).map(e => ({
      fecha: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      peso: e.weightBefore
    }));
  }, [selectedHawk]);

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto bg-[#020617] text-slate-100 overflow-hidden shadow-2xl relative">
      {loading && (
        <div className="absolute inset-0 bg-[#020617]/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      )}

      {view === 'AUTH' && (
        <div className="flex-1 flex flex-col p-8 justify-center items-center text-center">
          <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 rotate-3">
            <Bird className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black mb-1 tracking-tight">Falcon Weight <span className="text-emerald-500">PRO</span></h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-12">Elite Falconry Control</p>
          <div className="w-full space-y-3">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl outline-none focus:border-emerald-500 transition-all" />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl outline-none focus:border-emerald-500 transition-all" />
            <button onClick={() => handleAuth(true)} className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl active:scale-95 transition-all shadow-xl shadow-emerald-500/10">ENTRAR</button>
            <button onClick={() => handleAuth(false)} className="w-full py-2 text-slate-500 text-[10px] font-black uppercase tracking-widest mt-4">Crear nueva cuenta</button>
          </div>
          {IS_MOCK_MODE && <p className="mt-8 text-[9px] text-slate-600 uppercase font-black tracking-widest bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">Modo Demo (Persistencia Local)</p>}
        </div>
      )}

      {view === 'DASHBOARD' && (
        <>
          <header className="p-6 flex justify-between items-center border-b border-slate-900/50">
            <div>
              <h2 className="text-xl font-black tracking-tight">Falcon Weight <span className="text-emerald-500">PRO</span></h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{hawks.length} Ejemplares</p>
            </div>
            <button onClick={() => setView('ADD_HAWK')} className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"><Plus/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {hawks.map(h => (
              <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="bg-slate-900/50 border border-slate-800/50 p-4 rounded-3xl flex justify-between items-center active:bg-slate-800 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center"><Bird size={24}/></div>
                  <div>
                    <h3 className="font-bold text-lg">{h.name}</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{h.species}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black">{h.entries[0]?.weightBefore || '--'}<span className="text-[10px] text-emerald-500 ml-0.5">g</span></p>
                </div>
              </div>
            ))}
            {hawks.length === 0 && (
              <div className="text-center py-20">
                <Bird className="text-slate-800 w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-slate-600 font-bold text-sm">Sin halcones registrados</p>
              </div>
            )}
          </main>
          <footer className="p-4 border-t border-slate-900/50 flex justify-center">
            <button onClick={() => supabase.auth.signOut()} className="text-slate-600 font-black text-[10px] flex items-center gap-2 tracking-[0.2em]"><LogOut size={14}/> CERRAR SESIÓN</button>
          </footer>
        </>
      )}

      {view === 'HAWK_DETAILS' && selectedHawk && (
        <>
          <header className="p-6 flex justify-between items-center border-b border-slate-900/50">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-900 rounded-xl"><ChevronLeft size={20}/></button>
              <h2 className="font-black text-lg">{selectedHawk.name}</h2>
            </div>
            <button onClick={() => deleteHawkItem(selectedHawk.id)} className="text-slate-800 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-32">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500 p-5 rounded-3xl shadow-xl shadow-emerald-500/5">
                <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-1">Último Peso</p>
                <p className="text-3xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-sm font-bold opacity-60 ml-1">g</span></p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Vuelo</p>
                <p className="text-3xl font-black">{selectedHawk.targetWeight}<span className="text-sm font-bold text-slate-700 ml-1">g</span></p>
              </div>
            </div>

            <div className="h-52 bg-slate-900/30 rounded-3xl p-4 border border-slate-800/50">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="fecha" hide />
                  <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px'}} labelStyle={{fontWeight: 'black', color: '#10b981'}} />
                  <Area type="monotone" dataKey="peso" stroke="#10b981" fill="url(#colorWeight)" strokeWidth={4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {selectedHawk.entries.map(e => (
                <div key={e.id} className="bg-slate-900/50 p-4 rounded-2xl flex justify-between items-center border border-slate-800/30">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold capitalize">{new Date(e.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-500">+{e.totalFoodWeight}g</p>
                    <p className="text-[10px] font-bold text-slate-500">{e.weightBefore}g base</p>
                  </div>
                </div>
              ))}
            </div>
          </main>
          <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full py-5 bg-white text-black font-black rounded-3xl shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              <TrendingUp size={20} className="text-emerald-600"/> REGISTRAR PESADA
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-6 flex items-center gap-4">
            <button onClick={() => setView('HAWK_DETAILS')} className="p-2 bg-slate-900 rounded-xl"><ChevronLeft size={20}/></button>
            <h2 className="font-black text-xl">Nuevo Control</h2>
          </header>
          <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-10">
            <div className="space-y-3 text-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peso Actual (Gramos)</label>
              <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000" className="w-full p-8 bg-slate-900 border border-emerald-500/20 rounded-3xl font-black text-center text-5xl outline-none focus:border-emerald-500 transition-all" />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cebado</p>
                <p className="text-emerald-500 font-black text-xl">+{tempSelections.reduce((a,c)=>a+((FOOD_WEIGHT_MAP[c.category][c.portion]||0)*c.quantity),0)}g</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: 'Pollito', portion: 'Con Vitelo', quantity: 1}])} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase active:bg-emerald-500 transition-all">POLLITO C/V (25g)</button>
                <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: 'Pollito', portion: 'Sin Vitelo', quantity: 1}])} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase active:bg-emerald-500 transition-all">POLLITO S/V (20g)</button>
              </div>
            </div>

            <button onClick={saveEntry} className="w-full py-5 bg-emerald-500 text-white font-black rounded-3xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">GUARDAR PESADA</button>
          </main>
        </>
      )}

      {view === 'ADD_HAWK' && (
        <>
          <header className="p-6 flex items-center gap-4">
            <button onClick={() => setView('DASHBOARD')} className="p-2 bg-slate-900 rounded-xl"><ChevronLeft size={20}/></button>
            <h2 className="font-black text-xl">Registrar Halcón</h2>
          </header>
          <main className="p-6 space-y-5">
            <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Nombre del Halcón" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl font-bold outline-none focus:border-emerald-500" />
            <input value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} placeholder="Especie / Línea" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl font-bold outline-none focus:border-emerald-500" />
            <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Peso de Vuelo (g)" className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl font-bold text-emerald-500 outline-none focus:border-emerald-500" />
            <button onClick={addHawk} className="w-full py-5 bg-emerald-500 text-white font-black rounded-3xl shadow-xl mt-4">GUARDAR EN FALCON PRO</button>
          </main>
        </>
      )}
    </div>
  );
};

export default App;