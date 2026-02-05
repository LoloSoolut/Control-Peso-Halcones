import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  Target, Activity, Minus, Check, X, Mail, ShieldCheck, 
  Loader2, AlertCircle, WifiOff, UserCircle, Scale, MessageSquare, ChevronDown, 
  ArrowUpRight, ArrowDownRight, Zap, History, LayoutDashboard, Settings,
  Utensils, TrendingUp, Clock, Eye, EyeOff
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const SPECIES_OPTIONS = ['Peregrino', 'Híbrido', 'Gerifalte', 'Lanario', 'Sacre', 'Harris', 'Azor', 'Cernícalo'];

const FOOD_COLORS: Record<FoodCategory, { bg: string, border: string, text: string, accent: string }> = {
  'Chick': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', accent: 'bg-amber-600' },
  'Pigeon': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', accent: 'bg-rose-600' },
  'Quail': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', accent: 'bg-orange-600' },
  'Partridge': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', accent: 'bg-yellow-600' },
  'Duck': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', accent: 'bg-indigo-800' }
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawkId, setSelectedHawkId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');

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
        weight: e.weightBefore,
        target: selectedHawk.targetWeight
      }));
  }, [selectedHawk]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setView('DASHBOARD');
          loadData(session.user.id);
        }
      } catch (err) {
        console.error("Error inicializando sesión:", err);
      } finally {
        setIsInitialLoading(false);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('app-ready'));
        }, 300);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        if (view === 'AUTH' || view === 'SIGNUP') setView('DASHBOARD');
        loadData(session.user.id);
      } else {
        setUser(null);
        setView('AUTH');
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const loadData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('hawks')
        .select('*, entries(*)')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const formattedHawks = (data || []).map((h: any) => ({
        ...h,
        targetWeight: h.target_weight || h.targetWeight,
        entries: (h.entries || []).map((e: any) => ({
          ...e,
          weightBefore: e.weight_before || e.weightBefore,
          totalFoodWeight: (e.weight_after || e.weightAfter || 0) - (e.weight_before || e.weightBefore || 0),
          date: e.date || e.created_at
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      setHawks(formattedHawks);
    } catch (e: any) {
      console.error("Error cargando datos:", e);
    }
  };

  const handleAuth = async (action: 'LOGIN' | 'SIGNUP' | 'GUEST') => {
    if (actionLoading) return;
    setActionLoading(true);
    setAuthError(null);
    
    try {
      if (action === 'GUEST') {
        localStorage.setItem('falcon_use_local', 'true');
        window.location.reload();
        return;
      }
      
      if (action === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (action === 'SIGNUP') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("¡Cuenta creada! Verifica tu email.");
      }
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setActionLoading(false);
    }
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
      const wBeforeNum = parseFloat(weightBefore);
      const wAfterNum = wBeforeNum + totalFoodWeight;
      const { error } = await supabase.from('entries').insert([{ 
        hawk_id: selectedHawkId, 
        weight_before: wBeforeNum, 
        weight_after: wAfterNum, 
        date: new Date().toISOString() 
      }]);
      if (error) throw error;
      await loadData(user.id);
      setWeightBefore(''); 
      setCurrentFoodSelections([]); 
      setView('HAWK_DETAILS');
    } catch(e: any) {
        alert("Error de guardado: " + e.message);
    } finally { setActionLoading(false); }
  };

  const addHawk = async () => {
    if (!hawkName || !hawkTargetWeight || !user) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('hawks').insert([{ 
        name: hawkName.toUpperCase(), 
        species: hawkSpecies, 
        target_weight: parseFloat(hawkTargetWeight), 
        user_id: user.id 
      }]);
      if (error) throw error;
      await loadData(user.id);
      setHawkName(''); setHawkTargetWeight(''); setView('DASHBOARD');
    } catch(e: any) {
        alert(e.message);
    } finally { setActionLoading(false); }
  };

  // --- UI: AUTHENTICATION ---
  if (!user) {
    return (
      <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-md mx-auto w-full bg-slate-950 min-h-screen font-inter animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl rotate-3">
          <Bird className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black mb-1 uppercase italic tracking-tighter text-white">FALCON<span className="text-red-600">PRO</span></h1>
        <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.4em] mb-10 italic">Precision Management</p>
        
        <div className="w-full space-y-3">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="email" 
              placeholder="EMAIL" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold text-xs focus:border-red-600 transition-all outline-none" 
            />
          </div>

          <div className="relative">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="CONTRASEÑA" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full pl-11 pr-12 py-3.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold text-xs focus:border-red-600 transition-all outline-none" 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {authError && <p className="text-red-500 text-[10px] font-bold uppercase py-1">{authError}</p>}

          <button 
            disabled={actionLoading} 
            onClick={() => handleAuth(view === 'SIGNUP' ? 'SIGNUP' : 'LOGIN')} 
            className="w-full py-4 bg-red-600 text-white font-black rounded-xl shadow-xl uppercase tracking-widest text-xs hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
             {actionLoading ? <Loader2 className="animate-spin" size={18} /> : (view === 'SIGNUP' ? 'Crear Perfil' : 'Entrar')}
          </button>

          <button 
            onClick={() => setView(view === 'AUTH' ? 'SIGNUP' : 'AUTH')} 
            className="w-full pt-4 text-slate-500 text-[9px] font-black uppercase hover:text-white"
          >
            {view === 'AUTH' ? '¿Sin cuenta? Regístrate' : '¿Ya eres usuario? Inicia sesión'}
          </button>
          
          <button 
            onClick={() => handleAuth('GUEST')} 
            className="w-full py-3 text-slate-700 font-black uppercase text-[8px] tracking-widest hover:text-slate-500"
          >
            Modo Invitado (Offline)
          </button>
        </div>
      </div>
    );
  }

  // --- UI: DASHBOARD & VIEWS ---
  const currentView = (view === 'AUTH' || view === 'SIGNUP') ? 'DASHBOARD' : view;

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-slate-50 min-h-screen font-inter animate-in fade-in duration-500 pb-10">
      
      {currentView === 'DASHBOARD' && (
        <>
          <header className="px-6 py-8 flex justify-between items-center border-b border-slate-200 bg-white sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-red-600 shadow-lg"><Bird size={20} /></div>
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-slate-900">MI <span className="text-red-600">EQUIPO</span></h2>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{hawks.length} AVES</p>
              </div>
            </div>
            <button onClick={() => setView('ADD_HAWK')} className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"><Plus size={24}/></button>
          </header>

          <main className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hawks.map(h => {
                const lastEntry = h.entries[0];
                const diff = lastEntry ? lastEntry.weightBefore - h.targetWeight : 0;
                return (
                  <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="p-6 bg-white border border-slate-200 rounded-3xl cursor-pointer hover:border-red-600 transition-all shadow-sm active:scale-[0.98]">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 leading-tight">{h.name}</h3>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{h.species}</p>
                      </div>
                      <div className={`text-[7px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${Math.abs(diff) < 10 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {Math.abs(diff) < 10 ? 'PESO' : (diff > 0 ? 'ALTO' : 'TEMPLE')}
                      </div>
                    </div>
                    <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                      <div>
                         <p className="text-[7px] font-black text-slate-300 uppercase">TARGET</p>
                         <p className="text-sm font-black text-slate-400">{h.targetWeight}g</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[7px] font-black text-slate-300 uppercase">ACTUAL</p>
                         <p className="text-2xl font-black text-slate-900">{lastEntry?.weightBefore || '--'}<span className="text-xs ml-1 font-bold text-slate-300">g</span></p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hawks.length === 0 && (
              <div className="py-20 text-center opacity-20"><Bird size={60} className="mx-auto mb-2" /><p className="font-bold text-xs uppercase tracking-widest">Añade tu primer halcón</p></div>
            )}
            <div className="flex justify-center pt-8">
               <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase hover:text-red-600"><LogOut size={12} /> Salir del Sistema</button>
            </div>
          </main>
        </>
      )}

      {currentView === 'HAWK_DETAILS' && selectedHawk && (
        <>
          <header className="px-6 py-8 flex justify-between items-center bg-white border-b border-slate-200 sticky top-0 z-30">
            <button onClick={() => setView('DASHBOARD')} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 active:bg-slate-900 active:text-white"><ChevronLeft size={20}/></button>
            <div className="text-center">
              <h2 className="text-xl font-black italic uppercase tracking-tighter text-slate-900">{selectedHawk.name}</h2>
              <p className="text-[8px] font-black text-red-600 uppercase">{selectedHawk.species}</p>
            </div>
            <button onClick={async () => { if(confirm('¿Eliminar ave?')) { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); }}} className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center active:bg-rose-500 active:text-white"><Trash2 size={18}/></button>
          </header>

          <main className="p-4 space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">ÚLTIMO PESO</p>
              <div className="flex justify-between items-end">
                <p className="text-5xl font-black italic">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-xl not-italic ml-2 text-red-600">g</span></p>
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-500 uppercase">OBJETIVO</p>
                  <p className="text-lg font-black text-white/40">{selectedHawk.targetWeight}g</p>
                </div>
              </div>
            </div>

            <button onClick={() => setView('ADD_ENTRY')} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">REGISTRAR PESO HOY</button>

            <div className="space-y-3">
               <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">HISTORIAL RECIENTE</h3>
               {selectedHawk.entries.map(e => (
                 <div key={e.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><Scale size={16}/></div>
                       <div>
                         <p className="text-lg font-black text-slate-900">{e.weightBefore}<span className="text-xs text-slate-300 ml-1">g</span></p>
                         <p className="text-[7px] font-bold text-red-600 uppercase">GORGA: +{e.totalFoodWeight.toFixed(1)}g</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black text-slate-500 uppercase">{new Date(e.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                    </div>
                 </div>
               ))}
            </div>
          </main>
        </>
      )}

      {currentView === 'ADD_ENTRY' && (
        <main className="p-6 space-y-8 animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center">
            <button onClick={() => setView('HAWK_DETAILS')} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400"><ChevronLeft size={20}/></button>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">NUEVO <span className="text-red-600">REGISTRO</span></h2>
            <div className="w-10"></div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PESO EN BÁSCULA (g)</p>
            <input 
              value={weightBefore} 
              onChange={e => setWeightBefore(e.target.value)} 
              type="number" 
              placeholder="000.0" 
              className="w-full text-center text-6xl font-black outline-none text-slate-900 bg-transparent placeholder:text-slate-200 caret-red-600 tabular-nums italic" 
              autoFocus 
            />
            <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-2xl w-full text-white">
               <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg"><Utensils size={20} /></div>
               <div className="flex-1">
                  <p className="text-[7px] font-black text-slate-500 uppercase">GORGA TOTAL</p>
                  <p className="text-2xl font-black">{totalFoodWeight}<span className="text-sm ml-1 text-slate-500">g</span></p>
               </div>
            </div>
          </div>

          <div className="space-y-3">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ALIMENTO</p>
             <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                  <div key={cat} className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                    <p className="text-[7px] font-black uppercase text-slate-400">{cat}</p>
                    <div className="grid grid-cols-1 gap-1">
                      {(Object.keys(FOOD_WEIGHT_MAP[cat]) as FoodPortion[]).map(por => {
                         const sel = currentFoodSelections.find(f => f.category === cat && f.portion === por);
                         const qty = sel?.quantity || 0;
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
                           }} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center active:bg-slate-100">
                             <span className="text-[8px] font-bold text-slate-600">{por} ({FOOD_WEIGHT_MAP[cat][por]}g)</span>
                             {qty > 0 && <span className="bg-red-600 text-white text-[8px] px-1.5 rounded-md font-black">{qty}</span>}
                           </button>
                         );
                      })}
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="sticky bottom-4 left-0 right-0 px-2">
            <button 
              disabled={!weightBefore || actionLoading} 
              onClick={saveEntry} 
              className="w-full py-4 bg-slate-900 disabled:bg-slate-200 text-white font-black rounded-xl shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><Check size={20}/> GUARDAR SESIÓN</>}
            </button>
          </div>
        </main>
      )}

      {currentView === 'ADD_HAWK' && (
        <main className="p-6 space-y-8 animate-in slide-in-from-right-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('DASHBOARD')} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400"><ChevronLeft size={20}/></button>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">NUEVO <span className="text-red-600">HALCÓN</span></h2>
          </div>
          
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">NOMBRE</label>
              <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: RAYO" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-black text-lg focus:border-red-600 transition-all uppercase" />
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">ESPECIE</label>
              <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-black text-lg uppercase outline-none focus:border-red-600">
                {SPECIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">PESO OBJETIVO (g)</label>
              <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="000" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-black text-3xl focus:border-red-600 text-center" />
            </div>
            <button disabled={actionLoading} onClick={addHawk} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all">
              {actionLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'AÑADIR HALCÓN'}
            </button>
          </div>
        </main>
      )}

    </div>
  );
};

export default App;