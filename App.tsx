import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Eye, EyeOff, Utensils, Calendar, Target,
  ChevronRight, Info, Activity, Minus, Check, X, Mail, ShieldCheck, Loader2, AlertCircle, WifiOff
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase, IS_MOCK_MODE } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';

const SPECIES_OPTIONS = ['Peregrine', 'Hybrid', 'Gyrfalcon', 'Lanner', 'Saker'];

const FOOD_COLORS: Record<FoodCategory, { bg: string, border: string, text: string, hover: string, badge: string }> = {
  'Chick': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', hover: 'hover:bg-amber-100', badge: 'bg-amber-500' },
  'Pigeon': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', hover: 'hover:bg-red-100', badge: 'bg-red-600' },
  'Quail': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', hover: 'hover:bg-rose-100', badge: 'bg-rose-500' },
  'Partridge': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', hover: 'hover:bg-orange-100', badge: 'bg-orange-600' },
  'Duck': { bg: 'bg-red-900/5', border: 'border-red-900/20', text: 'text-red-950', hover: 'hover:bg-red-900/10', badge: 'bg-red-900' }
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawkId, setSelectedHawkId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Estados de Halcones
  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');

  // Estados de Registro Diario
  const [weightBefore, setWeightBefore] = useState('');
  const [currentFoodSelections, setCurrentFoodSelections] = useState<FoodSelection[]>([]);

  const selectedHawk = useMemo(() => 
    hawks.find(h => h.id === selectedHawkId) || null
  , [hawks, selectedHawkId]);

  const chartData = useMemo(() => {
    if (!selectedHawk || !selectedHawk.entries) return [];
    return [...selectedHawk.entries]
      .slice(0, 10)
      .reverse()
      .map(e => ({
        date: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        weight: e.weightBefore
      }));
  }, [selectedHawk]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app-ready'));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        setView('DASHBOARD');
        loadData(session.user.id);
      } else {
        setUser(null);
        if (view !== 'SIGNUP' && view !== 'RECOVER') setView('AUTH');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId: string) => {
    setDataError(null);
    try {
      const { data, error } = await supabase
        .from('hawks')
        .select('*, entries(*)')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const formattedHawks = (data || []).map((h: any) => ({
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
    } catch (e: any) {
      setDataError("Error al cargar datos. Verifica las tablas en Supabase.");
    }
  };

  const handleAuth = async (action: 'LOGIN' | 'SIGNUP' | 'RECOVER') => {
    if (actionLoading) return;
    setActionLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    
    try {
      if (action === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (action === 'SIGNUP') {
        if (!email || !password) throw new Error("Email y contraseña obligatorios.");
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          setAuthSuccessMsg("¡Éxito! Confirma tu email para poder entrar.");
        }
      } else if (action === 'RECOVER') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setAuthSuccessMsg("Instrucciones enviadas al email.");
      }
    } catch (e: any) {
      console.error("Auth Exception:", e);
      // Evitamos el error {} extrayendo el mensaje de texto
      const msg = e?.message || e?.error_description || (typeof e === 'string' ? e : "Error de conexión con el servidor");
      setAuthError(msg);
    } finally {
      setActionLoading(false);
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
    return Math.round((hawk.entries[0].weightBefore + hawk.entries[0].totalFoodWeight) - (avgLoss));
  };

  const totalFoodWeight = useMemo(() => {
    return currentFoodSelections.reduce((sum, item) => {
      const weight = FOOD_WEIGHT_MAP[item.category]?.[item.portion] || 0;
      return sum + (weight * item.quantity);
    }, 0);
  }, [currentFoodSelections]);

  const saveEntry = async () => {
    if (!selectedHawkId || !weightBefore || !user) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('entries').insert([{ 
        hawk_id: selectedHawkId, 
        weight_before: parseFloat(weightBefore), 
        total_food_weight: totalFoodWeight, 
        food_selections: currentFoodSelections, 
        date: new Date().toISOString() 
      }]);
      if (error) throw error;
      await loadData(user.id);
      setWeightBefore(''); setCurrentFoodSelections([]); setView('HAWK_DETAILS');
    } catch(e: any) {
        alert("Error al guardar: " + (e.message || "Verifica tu conexión"));
    } finally { setActionLoading(false); }
  };

  const addHawk = async () => {
    if (!hawkName || !hawkTargetWeight || !user) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('hawks').insert([{ 
        name: hawkName, 
        species: hawkSpecies, 
        target_weight: parseFloat(hawkTargetWeight), 
        user_id: user.id 
      }]);
      if (error) throw error;
      await loadData(user.id);
      setHawkName(''); setHawkTargetWeight(''); setView('DASHBOARD');
    } catch(e: any) {
        alert("Error al crear halcón: " + (e.message || "Asegúrate de haber ejecutado el SQL en Supabase"));
    } finally { setActionLoading(false); }
  };

  if (!user && (view === 'AUTH' || view === 'SIGNUP' || view === 'RECOVER')) {
    return (
      <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-sm mx-auto w-full font-inter">
        <div className="w-20 h-20 bg-red-600 rounded-[1.8rem] flex items-center justify-center mb-6 shadow-2xl">
          <Bird className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black mb-1 uppercase italic tracking-tighter">FALCON <span className="text-red-600">PRO</span></h1>
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.5em] mb-10">REGISTRO DIARIO</p>
        
        <div className="w-full space-y-4">
          <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold" />
          {view !== 'RECOVER' && (
            <input type={showPassword ? "text" : "password"} placeholder="CONTRASEÑA" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold" />
          )}

          {authError && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase">{authError}</div>}
          {authSuccessMsg && <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-[10px] font-bold uppercase">{authSuccessMsg}</div>}

          <button disabled={actionLoading} onClick={() => handleAuth(view === 'SIGNUP' ? 'SIGNUP' : (view === 'RECOVER' ? 'RECOVER' : 'LOGIN'))} className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl border-b-4 border-red-800 flex items-center justify-center gap-2 uppercase tracking-widest">
            {actionLoading ? <Loader2 className="animate-spin" /> : (view === 'SIGNUP' ? 'Registrarse' : (view === 'RECOVER' ? 'Recuperar' : 'Entrar'))}
          </button>
          
          <div className="pt-4 flex flex-col gap-2">
            {view === 'AUTH' ? (
              <button onClick={() => setView('SIGNUP')} className="text-slate-400 text-[10px] font-black uppercase">¿No tienes cuenta? <span className="text-slate-900">Regístrate</span></button>
            ) : (
              <button onClick={() => setView('AUTH')} className="text-slate-400 text-[10px] font-black uppercase">Volver al login</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white overflow-hidden md:rounded-[2.5rem] relative border-x border-slate-100 font-inter">
      {user && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {dataError && <div className="bg-amber-500 text-white text-[9px] p-2 text-center font-black uppercase">{dataError}</div>}
          
          {view === 'DASHBOARD' && (
            <>
              <header className="p-8 flex justify-between items-center border-b border-slate-50">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">MIS <span className="text-red-600">HALCONES</span></h2>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{hawks.length} AVES</p>
                </div>
                <button onClick={() => setView('ADD_HAWK')} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl border-b-4 border-red-800"><Plus size={32}/></button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {hawks.map(h => (
                  <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="p-6 bg-slate-50 rounded-[2.5rem] flex items-center justify-between cursor-pointer active:scale-95 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-red-600"><Bird size={24}/></div>
                      <div><h3 className="font-black text-xl">{h.name}</h3><p className="text-[9px] font-black text-slate-400 uppercase">{h.species}</p></div>
                    </div>
                    <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Último Peso</p><p className="font-black text-lg">{h.entries[0]?.weightBefore || '--'}g</p></div>
                  </div>
                ))}
                <button onClick={() => supabase.auth.signOut()} className="w-full py-4 text-slate-300 text-[10px] font-black uppercase flex items-center justify-center gap-2"><LogOut size={14}/> Cerrar Sesión</button>
              </main>
            </>
          )}

          {view === 'HAWK_DETAILS' && selectedHawk && (
            <>
              <header className="p-8 flex justify-between items-center border-b border-slate-50">
                <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center"><ChevronLeft/></button>
                <h2 className="font-black text-2xl italic">{selectedHawk.name}</h2>
                <button onClick={async () => { if(confirm('¿Borrar?')) { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); }}} className="w-12 h-12 text-slate-200 hover:text-red-600 flex items-center justify-center"><Trash2 size={20}/></button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-red-600 p-6 rounded-[2.5rem] text-white">
                     <p className="text-[9px] font-black uppercase opacity-60">Peso hoy</p>
                     <p className="text-4xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}g</p>
                   </div>
                   <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white">
                     <p className="text-[9px] font-black uppercase opacity-60">Ideal</p>
                     <p className="text-4xl font-black">{selectedHawk.targetWeight}g</p>
                   </div>
                </div>
                {selectedHawk.entries.length > 0 && (
                  <div className="bg-white border-2 border-slate-50 p-6 rounded-[2.5rem] h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <XAxis dataKey="date" hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="weight" stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </main>
              <div className="fixed bottom-10 left-0 right-0 px-8 flex justify-center">
                <button onClick={() => setView('ADD_ENTRY')} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-widest border-b-4 border-red-800">
                  Registrar Peso
                </button>
              </div>
            </>
          )}

          {view === 'ADD_ENTRY' && (
            <main className="p-8 space-y-8 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-32">
              <div className="flex justify-between items-center">
                <button onClick={() => setView('HAWK_DETAILS')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center"><ChevronLeft/></button>
                <h2 className="font-black text-xl italic uppercase">PESO <span className="text-red-600">HOY</span></h2>
                <div className="w-12"></div>
              </div>
              <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000" className="w-full text-center text-8xl font-black outline-none tabular-nums" />
              
              <div className="bg-slate-900 text-white p-6 rounded-[2rem] flex justify-between items-center">
                <span className="font-black uppercase text-[10px]">Total Comida</span>
                <span className="text-3xl font-black text-red-500">{totalFoodWeight}g</span>
              </div>

              <div className="space-y-4">
                {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                  <div key={cat} className={`${FOOD_COLORS[cat].bg} p-4 rounded-[2rem] border-2 ${FOOD_COLORS[cat].border}`}>
                    <p className={`text-[10px] font-black uppercase mb-3 ${FOOD_COLORS[cat].text}`}>{cat}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(FOOD_WEIGHT_MAP[cat]) as FoodPortion[]).map(por => {
                         const qty = currentFoodSelections.find(f => f.category === cat && f.portion === por)?.quantity || 0;
                         return (
                           <button key={por} onClick={() => {
                             setCurrentFoodSelections(prev => {
                               const idx = prev.findIndex(f => f.category === cat && f.portion === por);
                               if (idx > -1) {
                                 const updated = [...prev];
                                 updated[idx].quantity += 1;
                                 return updated;
                               }
                               return [...prev, { id: Math.random().toString(), category: cat, portion: por, quantity: 1 }];
                             });
                           }} className="bg-white p-3 rounded-xl border border-slate-100 relative flex flex-col items-center">
                             <span className="text-[8px] font-black uppercase opacity-40">{por}</span>
                             <span className="font-black">{FOOD_WEIGHT_MAP[cat][por]}g</span>
                             {qty > 0 && <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center font-black">{qty}</div>}
                           </button>
                         );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="fixed bottom-8 left-0 right-0 px-8 flex justify-center">
                <button disabled={!weightBefore || actionLoading} onClick={saveEntry} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-2xl uppercase border-b-4 border-red-800 flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="animate-spin" /> : 'Finalizar Registro'}
                </button>
              </div>
            </main>
          )}

          {view === 'ADD_HAWK' && (
            <main className="p-8 space-y-6 flex-1 flex flex-col">
              <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center"><ChevronLeft/></button>
              <h2 className="text-3xl font-black italic uppercase">NUEVO <span className="text-red-600">HALCÓN</span></h2>
              <div className="space-y-4">
                <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="NOMBRE" className="w-full p-6 bg-slate-50 rounded-2xl font-black" />
                <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 rounded-2xl font-black uppercase">{SPECIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="PESO VUELO (g)" className="w-full p-6 bg-slate-50 rounded-2xl font-black" />
              </div>
              <button disabled={actionLoading} onClick={addHawk} className="w-full py-6 bg-red-600 text-white font-black rounded-[2rem] mt-auto uppercase border-b-4 border-red-800">
                {actionLoading ? <Loader2 className="animate-spin" /> : 'Guardar Halcón'}
              </button>
            </main>
          )}
        </div>
      )}
    </div>
  );
};

export default App;