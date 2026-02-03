import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Activity, Calculator, X, ChevronDown
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

const SPECIES_OPTIONS = ['Peregrino', 'Híbrido', 'Gerifalte', 'Lanario', 'Sacre'];

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
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
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
        species: hawkSpecies,
        targetWeight: parseInt(hawkTargetWeight),
        entries: []
      };
      saveDataLocally([...hawks, newHawk]);
      setHawkName(''); setHawkSpecies(SPECIES_OPTIONS[0]); setHawkTargetWeight('');
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
      setHawkName(''); setHawkSpecies(SPECIES_OPTIONS[0]); setHawkTargetWeight('');
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
    return [...selectedHawk.entries].reverse().slice(-10).map(e => ({
      fecha: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      peso: e.weightBefore
    }));
  }, [selectedHawk]);

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-[#020617] text-slate-100 overflow-hidden md:shadow-2xl md:my-4 md:rounded-[2.5rem] relative border-x border-slate-900">
      {loading && (
        <div className="absolute inset-0 bg-[#020617]/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      )}

      {view === 'AUTH' && (
        <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-md mx-auto w-full">
          <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20 rotate-6">
            <Bird className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">Falcon Weight <span className="text-emerald-500">PRO</span></h1>
          <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.4em] mb-12">Professional Falconry Control</p>
          <div className="w-full space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-slate-900/50 border border-slate-800 rounded-2xl outline-none focus:border-emerald-500 transition-all font-medium text-lg" />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-slate-900/50 border border-slate-800 rounded-2xl outline-none focus:border-emerald-500 transition-all font-medium text-lg" />
            <button onClick={() => handleAuth(true)} className="w-full py-5 bg-emerald-500 text-white font-black rounded-2xl active:scale-[0.98] transition-all shadow-xl shadow-emerald-500/10 text-xl">ENTRAR AL SISTEMA</button>
            <button onClick={() => handleAuth(false)} className="w-full py-2 text-slate-500 text-[11px] font-black uppercase tracking-widest mt-6 hover:text-emerald-400 transition-colors">Solicitar Registro</button>
          </div>
          {IS_MOCK_MODE && <p className="mt-12 text-[10px] text-slate-600 uppercase font-black tracking-[0.2em] bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800">Demo: Persistencia en este navegador</p>}
        </div>
      )}

      {view === 'DASHBOARD' && (
        <>
          <header className="p-8 md:p-10 flex justify-between items-center border-b border-slate-900/80">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Falcon Weight <span className="text-emerald-500">PRO</span></h2>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1">{hawks.length} Halcones en Cámara</p>
            </div>
            <button onClick={() => setView('ADD_HAWK')} className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-90 transition-transform"><Plus size={28}/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 no-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hawks.map(h => (
                <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-[2rem] flex justify-between items-center active:bg-slate-800 hover:border-emerald-500/30 transition-all cursor-pointer group">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"><Bird size={28}/></div>
                    <div>
                      <h3 className="font-black text-xl">{h.name}</h3>
                      <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">{h.species}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">{h.entries[0]?.weightBefore || '--'}<span className="text-xs text-emerald-500 ml-1">g</span></p>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Última pesada</p>
                  </div>
                </div>
              ))}
            </div>
            {hawks.length === 0 && (
              <div className="text-center py-32 flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 opacity-40">
                  <Bird className="text-slate-600 w-10 h-10" />
                </div>
                <p className="text-slate-500 font-black text-lg uppercase tracking-widest">Inicia el plantel</p>
                <p className="text-slate-600 text-sm mt-2">No hay halcones registrados todavía</p>
              </div>
            )}
          </main>
          <footer className="p-6 border-t border-slate-900/50 flex justify-center bg-slate-900/20">
            <button onClick={() => supabase.auth.signOut()} className="text-slate-600 font-black text-[11px] flex items-center gap-3 tracking-[0.3em] hover:text-red-400 transition-colors"><LogOut size={16}/> FINALIZAR SESIÓN</button>
          </footer>
        </>
      )}

      {view === 'HAWK_DETAILS' && selectedHawk && (
        <>
          <header className="p-8 md:p-10 flex justify-between items-center border-b border-slate-900/80">
            <div className="flex items-center gap-5">
              <button onClick={() => setView('DASHBOARD')} className="p-3 bg-slate-900 rounded-2xl hover:bg-slate-800 transition-colors"><ChevronLeft size={24}/></button>
              <div>
                <h2 className="font-black text-2xl tracking-tight">{selectedHawk.name}</h2>
                <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full tracking-widest">{selectedHawk.species}</span>
              </div>
            </div>
            <button onClick={() => deleteHawkItem(selectedHawk.id)} className="text-slate-800 hover:text-red-500 transition-colors p-2"><Trash2 size={24}/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 no-scrollbar pb-32">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500 p-7 rounded-[2.5rem] shadow-2xl shadow-emerald-500/5">
                <p className="text-[11px] font-black text-emerald-950 uppercase tracking-widest mb-1 opacity-80">Peso Actual</p>
                <p className="text-4xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-lg font-bold opacity-60 ml-1">g</span></p>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-7 rounded-[2.5rem]">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Peso Vuelo</p>
                <p className="text-4xl font-black">{selectedHawk.targetWeight}<span className="text-lg font-bold text-slate-700 ml-1">g</span></p>
              </div>
            </div>

            <div className="bg-slate-900/30 rounded-[2.5rem] p-6 md:p-8 border border-slate-800/50">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Gráfica de Rendimiento</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[9px] font-bold text-slate-600 uppercase">Peso</span></div>
                  </div>
               </div>
               <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.3} />
                    <XAxis dataKey="fecha" hide />
                    <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'}} labelStyle={{fontWeight: 'black', color: '#10b981'}} />
                    <Area type="monotone" dataKey="peso" stroke="#10b981" fill="url(#colorWeight)" strokeWidth={5} animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] ml-4 mb-4">Registro Histórico</p>
              <div className="grid grid-cols-1 gap-2">
                {selectedHawk.entries.map(e => (
                  <div key={e.id} className="bg-slate-900/50 p-5 rounded-3xl flex justify-between items-center border border-slate-800/30 hover:bg-slate-800/40 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-black capitalize text-slate-300">{new Date(e.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Pesada Controlada</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-500">+{e.totalFoodWeight}<span className="text-[10px] ml-0.5">g</span></p>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Cebadura</p>
                      </div>
                      <div className="w-1 bg-slate-800 h-8 rounded-full"></div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-300">{e.weightBefore}<span className="text-[10px] ml-0.5">g</span></p>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Inicial</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
          <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-center pointer-events-none">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full max-w-sm py-6 bg-white text-black font-black rounded-3xl shadow-[0_20px_50px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto text-lg">
              <TrendingUp size={24} className="text-emerald-600"/> NUEVA PESADA
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && selectedHawk && (
        <>
          <header className="p-8 md:p-10 flex items-center gap-5">
            <button onClick={() => setView('HAWK_DETAILS')} className="p-3 bg-slate-900 rounded-2xl"><ChevronLeft size={24}/></button>
            <h2 className="font-black text-2xl">Control Diario</h2>
          </header>
          <main className="flex-1 overflow-y-auto p-8 md:p-10 space-y-10 no-scrollbar pb-10">
            <div className="space-y-4 text-center">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Peso del Halcón (Gramos)</label>
              <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000.0" className="w-full p-10 bg-slate-900/50 border border-emerald-500/20 rounded-[2.5rem] font-black text-center text-6xl outline-none focus:border-emerald-500 transition-all shadow-inner placeholder:opacity-10" />
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-end px-4">
                <div>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1">Calculadora de Ceba</p>
                    <p className="text-slate-600 text-xs font-bold">Selecciona las porciones dadas</p>
                </div>
                <p className="text-emerald-500 font-black text-3xl">+{tempSelections.reduce((a,c)=>a+((FOOD_WEIGHT_MAP[c.category][c.portion]||0)*c.quantity),0)}<span className="text-sm ml-1">g</span></p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: 'Pollito', portion: 'Con Vitelo', quantity: 1}])} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl text-[11px] font-black uppercase active:bg-emerald-500 active:text-white transition-all shadow-lg">POLLITO C/V (25g)</button>
                <button onClick={() => setTempSelections([...tempSelections, {id: Math.random().toString(), category: 'Pollito', portion: 'Sin Vitelo', quantity: 1}])} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl text-[11px] font-black uppercase active:bg-emerald-500 active:text-white transition-all shadow-lg">POLLITO S/V (20g)</button>
              </div>

              {tempSelections.length > 0 && (
                <div className="space-y-2 p-4 bg-slate-900/30 rounded-3xl border border-slate-800/50">
                   {tempSelections.map(s => (
                    <div key={s.id} className="flex justify-between items-center bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                      <span className="text-[10px] font-black uppercase tracking-widest">{s.category} ({s.portion})</span>
                      <button onClick={() => setTempSelections(tempSelections.filter(x => x.id !== s.id))} className="text-red-500/50 hover:text-red-500 transition-colors"><X size={18}/></button>
                    </div>
                  ))}
                  <button onClick={() => setTempSelections([])} className="w-full py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest mt-2">Limpiar selección</button>
                </div>
              )}
            </div>

            <button onClick={saveEntry} className="w-full py-6 bg-emerald-500 text-white font-black rounded-[2rem] shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all text-xl mt-6 uppercase tracking-widest">GUARDAR PESADA</button>
          </main>
        </>
      )}

      {view === 'ADD_HAWK' && (
        <>
          <header className="p-8 md:p-10 flex items-center gap-5">
            <button onClick={() => setView('DASHBOARD')} className="p-3 bg-slate-900 rounded-2xl"><ChevronLeft size={24}/></button>
            <h2 className="font-black text-2xl tracking-tight">Nuevo Halcón</h2>
          </header>
          <main className="p-8 md:p-10 space-y-8 max-w-2xl mx-auto w-full">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Nombre identificativo</label>
              <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: Rayo, Luna..." className="w-full p-5 bg-slate-900 border border-slate-800 rounded-2xl font-bold outline-none focus:border-emerald-500 text-lg transition-colors" />
            </div>
            
            <div className="space-y-2 relative">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Especie / Línea</label>
              <select 
                value={hawkSpecies} 
                onChange={e => setHawkSpecies(e.target.value)} 
                className="w-full p-5 bg-slate-900 border border-slate-800 rounded-2xl font-bold outline-none focus:border-emerald-500 text-lg transition-colors"
              >
                {SPECIES_OPTIONS.map(opt => (
                  <option key={opt} value={opt} className="bg-slate-950 text-slate-100">{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-4">Peso de Vuelo (Gramos)</label>
              <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Ej: 850" className="w-full p-5 bg-slate-900 border border-slate-800 rounded-2xl font-bold text-emerald-500 outline-none focus:border-emerald-500 text-lg transition-colors" />
            </div>

            <button onClick={addHawk} className="w-full py-6 bg-emerald-500 text-white font-black rounded-[2rem] shadow-2xl mt-8 text-xl active:scale-[0.98] transition-all uppercase tracking-widest">REGISTRAR EN PLANTEL</button>
          </main>
        </>
      )}
    </div>
  );
};

export default App;