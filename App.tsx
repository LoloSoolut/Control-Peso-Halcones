import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  Target, Activity, Minus, Check, X, Mail, ShieldCheck, 
  Loader2, AlertCircle, WifiOff, UserCircle, Scale, MessageSquare, ChevronDown, 
  ArrowUpRight, ArrowDownRight, Zap, History, LayoutDashboard, Settings,
  // Added Utensils to the imports from lucide-react
  Utensils
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase, IS_MOCK_MODE } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const SPECIES_OPTIONS = ['Peregrino', 'Híbrido', 'Gerifalte', 'Lanario', 'Sacre', 'Harris', 'Azor'];

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
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawkId, setSelectedHawkId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');

  const [weightBefore, setWeightBefore] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [currentFoodSelections, setCurrentFoodSelections] = useState<FoodSelection[]>([]);

  const selectedHawk = useMemo(() => 
    hawks.find(h => h.id === selectedHawkId) || null
  , [hawks, selectedHawkId]);

  const chartData = useMemo(() => {
    if (!selectedHawk || !selectedHawk.entries) return [];
    return [...selectedHawk.entries]
      .slice(0, 15)
      .reverse()
      .map(e => ({
        date: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        weight: e.weightBefore,
        target: selectedHawk.targetWeight
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
        targetWeight: h.target_weight || h.targetWeight,
        entries: (h.entries || []).map((e: any) => ({
          ...e,
          weightBefore: e.weight_before || e.weightBefore,
          totalFoodWeight: e.total_food_weight || e.totalFoodWeight,
          // Evitamos errores de carga si food_selections no existe en DB
          foodSelections: e.food_selections || [],
          notes: e.notes || ''
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      setHawks(formattedHawks);
    } catch (e: any) {
      setDataError("Error al sincronizar datos.");
    }
  };

  const handleAuth = async (action: 'LOGIN' | 'SIGNUP' | 'RECOVER' | 'GUEST') => {
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
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) setAuthSuccessMsg("Revisa tu email.");
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
      // Nota: Si food_selections no existe como columna, concatenamos los datos en 'notes'
      const foodSummary = currentFoodSelections.map(f => `${f.quantity}x ${f.category} (${f.portion})`).join(', ');
      const finalNotes = `${entryNotes}${entryNotes ? ' | ' : ''}Comida: ${foodSummary}`;

      const { error } = await supabase.from('entries').insert([{ 
        hawk_id: selectedHawkId, 
        weight_before: parseFloat(weightBefore), 
        total_food_weight: totalFoodWeight, 
        notes: finalNotes,
        date: new Date().toISOString() 
      }]);
      if (error) throw error;
      await loadData(user.id);
      setWeightBefore(''); setEntryNotes(''); setCurrentFoodSelections([]); setView('HAWK_DETAILS');
    } catch(e: any) {
        alert("Error: " + e.message);
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
        alert(e.message);
    } finally { setActionLoading(false); }
  };

  const getWeightStatus = (current: number, target: number) => {
    const diff = current - target;
    if (Math.abs(diff) <= 10) return { label: 'EN PESO', color: 'bg-emerald-500', text: 'text-emerald-500', icon: <Zap size={10}/> };
    if (diff > 10) return { label: 'GORDO', color: 'bg-amber-500', text: 'text-amber-500', icon: <ArrowUpRight size={10}/> };
    return { label: 'TEMPLADO', color: 'bg-red-500', text: 'text-red-500', icon: <ArrowDownRight size={10}/> };
  };

  // Auth View
  if (!user && (view === 'AUTH' || view === 'SIGNUP' || view === 'RECOVER')) {
    return (
      <div className="flex-1 flex flex-col p-10 justify-center items-center text-center max-w-md mx-auto w-full bg-white md:rounded-[3rem] md:shadow-2xl md:my-10 border border-slate-100 animate-in fade-in zoom-in duration-700">
        <div className="w-24 h-24 bg-gradient-to-tr from-slate-900 to-red-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-red-200 rotate-3">
          <Bird className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-5xl font-black mb-1 uppercase italic tracking-tighter text-slate-900">FALCON<span className="text-red-600">PRO</span></h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mb-12">SISTEMA OPERATIVO DE CETRERÍA</p>
        
        <div className="w-full space-y-4">
          <input type="email" placeholder="EMAIL DE CETRERO" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 focus:bg-white font-bold text-sm uppercase transition-all" />
          <input type="password" placeholder="CONTRASEÑA" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 focus:bg-white font-bold text-sm uppercase transition-all" />
          <button disabled={actionLoading} onClick={() => handleAuth(view === 'SIGNUP' ? 'SIGNUP' : 'LOGIN')} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-[0.98] hover:bg-red-600 transition-all">
            {actionLoading ? <Loader2 className="animate-spin mx-auto" /> : (view === 'SIGNUP' ? 'Crear Perfil' : 'Acceder')}
          </button>
          <button onClick={() => handleAuth('GUEST')} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors">Entrar como invitado (Local)</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto bg-slate-50 overflow-hidden md:rounded-[3.5rem] relative md:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] md:my-8 border border-white/50 font-inter">
      {user && (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white/40 backdrop-blur-3xl">
          
          {view === 'DASHBOARD' && (
            <>
              <header className="px-8 py-10 md:px-14 flex justify-between items-center border-b border-slate-100/50 sticky top-0 bg-white/70 backdrop-blur-2xl z-20">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Bird className="text-red-600 animate-pulse" size={32} />
                    <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-slate-900">CENTRAL<span className="text-red-600/60">FLIGHT</span></h2>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">{hawks.length} AVES REGISTRADAS</p>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setView('ADD_HAWK')} className="hidden md:flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all"><Plus size={16}/> Nuevo Halcón</button>
                  <button onClick={() => setView('ADD_HAWK')} className="md:hidden w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-200"><Plus size={28}/></button>
                  <button onClick={() => supabase.auth.signOut()} className="w-14 h-14 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"><LogOut size={20}/></button>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto p-6 md:p-14 space-y-10 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hawks.map(h => {
                    const lastEntry = h.entries[0];
                    const status = lastEntry ? getWeightStatus(lastEntry.weightBefore, h.targetWeight) : null;
                    return (
                      <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="group relative p-8 bg-white border border-slate-100 rounded-[3rem] cursor-pointer hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden active:scale-95 border-b-4 border-b-slate-100 hover:border-b-red-600">
                        <div className="flex justify-between items-start mb-8">
                          <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-900 group-hover:bg-red-600 group-hover:text-white transition-all duration-500"><Bird size={28}/></div>
                          {status && (
                            <div className={`px-3 py-1.5 rounded-full ${status.color} bg-opacity-10 ${status.text} text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5`}>
                              {status.icon} {status.label}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          <h3 className="text-2xl font-black text-slate-900 group-hover:text-red-600 transition-colors">{h.name.toUpperCase()}</h3>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{h.species}</p>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-end">
                          <div>
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">OBJETIVO</p>
                            <p className="text-xl font-black text-slate-400">{h.targetWeight}g</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">PESO ACTUAL</p>
                            <p className="text-4xl font-black text-slate-900 leading-none">{lastEntry?.weightBefore || '--'}<span className="text-xs ml-1 text-slate-300">g</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {hawks.length === 0 && (
                  <div className="py-24 flex flex-col items-center justify-center text-slate-200 border-2 border-dashed border-slate-100 rounded-[3rem]">
                    <Bird size={80} className="mb-4 opacity-10" />
                    <p className="text-[12px] font-black uppercase tracking-[0.4em]">Sin halcones en la flota</p>
                  </div>
                )}
              </main>
            </>
          )}

          {view === 'HAWK_DETAILS' && selectedHawk && (
            <>
              <header className="px-8 py-10 md:px-14 flex justify-between items-center border-b border-slate-100/50 sticky top-0 bg-white/80 backdrop-blur-2xl z-30">
                <button onClick={() => setView('DASHBOARD')} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-red-600 hover:text-white transition-all"><ChevronLeft size={24}/></button>
                <div className="text-center">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">{selectedHawk.name}</h2>
                  <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.4em]">{selectedHawk.species}</p>
                </div>
                <button onClick={async () => { if(confirm('¿Borrar halcón?')) { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); }}} className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={20}/></button>
              </header>

              <main className="flex-1 overflow-y-auto p-6 md:p-14 space-y-10 no-scrollbar pb-40">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 bg-slate-900 rounded-[3.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-red-600/20 to-transparent pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-10">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">PESO REGISTRADO HOY</p>
                        <p className="text-8xl md:text-9xl font-black leading-none tracking-tighter italic">{selectedHawk.entries[0]?.weightBefore || '---'}<span className="text-2xl font-bold ml-2 text-red-600 not-italic">g</span></p>
                        <div className="mt-8 flex items-center gap-4">
                          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                             <Target size={14} className="text-red-500" />
                             <span className="text-xs font-black uppercase tracking-widest text-slate-400">OBJETIVO: {selectedHawk.targetWeight}g</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full md:w-64 h-32 bg-white/5 rounded-3xl p-2 border border-white/10">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <Area type="monotone" dataKey="weight" stroke="#dc2626" strokeWidth={3} fill="#dc2626" fillOpacity={0.1} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-[3rem] p-8 flex flex-col justify-between shadow-lg">
                    <div className="space-y-6">
                      <div className="p-5 bg-slate-50 rounded-2xl text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ÚLTIMA GORGA</p>
                        <p className="text-3xl font-black text-slate-900">+{selectedHawk.entries[0]?.totalFoodWeight || 0}<span className="text-sm ml-1 text-slate-300">g</span></p>
                      </div>
                      <div className="p-5 bg-red-50 rounded-2xl text-center">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">TEMPLE</p>
                        <p className="text-3xl font-black text-red-600">
                          {selectedHawk.entries.length > 1 
                            ? (selectedHawk.entries[0].weightBefore - selectedHawk.entries[1].weightBefore)
                            : '--'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setView('ADD_ENTRY')} className="mt-6 w-full py-5 bg-red-600 text-white rounded-[1.8rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all">REGISTRAR</button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 px-4">
                    <History size={18} className="text-slate-300" />
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">LOG DE VUELOS Y SALUD</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedHawk.entries.map(e => (
                      <div key={e.id} className="p-8 bg-white border border-slate-100 rounded-[2.8rem] group hover:border-red-600 transition-all">
                        <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 group-hover:bg-red-600 group-hover:text-white transition-all"><Scale size={18}/></div>
                              <div>
                                <p className="text-2xl font-black text-slate-900 leading-none">{e.weightBefore}<span className="text-xs text-slate-300 ml-1 font-bold">g</span></p>
                                <p className="text-[9px] font-bold text-red-600 uppercase mt-1">GORGA: +{e.totalFoodWeight}g</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                              <p className="text-[8px] font-bold text-slate-200 uppercase">{new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                           </div>
                        </div>
                        {e.notes && (
                          <div className="p-4 bg-slate-50 rounded-2xl flex gap-3 border border-slate-100/50">
                             <MessageSquare size={14} className="text-slate-300 mt-0.5 shrink-0" />
                             <p className="text-[11px] italic text-slate-500 leading-relaxed">{e.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </main>
            </>
          )}

          {view === 'ADD_ENTRY' && (
            <main className="p-8 md:p-14 space-y-12 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-36 animate-in slide-in-from-bottom-20 duration-700">
              <div className="flex justify-between items-center">
                <button onClick={() => setView('HAWK_DETAILS')} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-red-600 hover:text-white transition-all"><ChevronLeft size={24}/></button>
                <div className="text-center">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">CONTROL <span className="text-red-600">DIARIO</span></h2>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="w-14"></div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">
                <div className="space-y-10">
                  <div className="text-center">
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] mb-6">PESO EN BÁSCULA (g)</p>
                    <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000.0" className="w-full text-center text-9xl font-black outline-none text-slate-900 bg-transparent placeholder:text-slate-100 caret-red-600 tabular-nums italic tracking-tighter" autoFocus />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-4">
                      <MessageSquare size={14} className="text-red-600" />
                      <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">DIARIO DE VUELO</p>
                    </div>
                    <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Ej: Vuelo altanero muy centrado, buena respuesta al señuelo..." className="w-full h-36 p-8 bg-slate-50 border-2 border-slate-100 rounded-[3rem] outline-none focus:border-red-600 focus:bg-white font-medium text-slate-600 transition-all resize-none shadow-inner" />
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative border-b-[12px] border-slate-800">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <Utensils size={20} className="text-red-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">TOTAL GORGA</span>
                      </div>
                      <span className="px-3 py-1 bg-red-600 rounded-lg text-[8px] font-black">AUTO</span>
                    </div>
                    <div className="flex items-end gap-3">
                      <span className="text-8xl font-black italic">{totalFoodWeight}</span>
                      <span className="text-2xl font-bold text-slate-600 mb-2 italic">gramos</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                      <div key={cat} className={`${FOOD_COLORS[cat].bg} p-6 rounded-[2.8rem] border border-transparent hover:border-slate-200 transition-all space-y-4`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${FOOD_COLORS[cat].text}`}>{cat}</p>
                        <div className="grid grid-cols-2 gap-3">
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
                               }} className="group bg-white p-4 rounded-2xl border border-slate-100 relative flex flex-col items-center active:scale-90 transition-all shadow-sm">
                                 <span className="text-[7px] font-black uppercase text-slate-300 group-hover:text-red-600 mb-1">{por}</span>
                                 <span className="font-black text-lg text-slate-900">{FOOD_WEIGHT_MAP[cat][por]}g</span>
                                 {qty > 0 && <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center font-black border-4 border-white animate-in zoom-in">{qty}</div>}
                               </button>
                             );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="fixed bottom-10 left-0 right-0 px-8 flex justify-center z-50 pointer-events-none">
                <button disabled={!weightBefore || actionLoading} onClick={saveEntry} className="group w-full max-w-sm py-6 bg-slate-900 disabled:bg-slate-200 text-white font-black rounded-[2.5rem] shadow-2xl uppercase tracking-[0.3em] active:scale-95 hover:bg-red-600 transition-all pointer-events-auto flex items-center justify-center gap-4">
                  {actionLoading ? <Loader2 className="animate-spin" /> : <><Check size={28}/> GUARDAR SESIÓN</>}
                </button>
              </div>
            </main>
          )}

          {view === 'ADD_HAWK' && (
            <main className="p-8 md:p-14 space-y-12 flex-1 flex flex-col items-center animate-in slide-in-from-right-20 duration-700">
              <div className="w-full flex items-center gap-6">
                <button onClick={() => setView('DASHBOARD')} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft size={24}/></button>
                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-900">ALTA DE <span className="text-red-600">HALCÓN</span></h2>
              </div>
              
              <div className="w-full max-w-2xl space-y-8 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-6">NOMBRE DEL AVE</label>
                  <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: RAYO NEGRO" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-2xl outline-none focus:border-red-600 transition-all uppercase" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-6">ESPECIE / HÍBRIDO</label>
                  <div className="relative">
                    <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-2xl outline-none uppercase appearance-none focus:border-red-600 transition-all">
                      {SPECIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 text-red-600" size={24} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-6">PESO IDEAL DE VUELO (g)</label>
                  <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="000" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-5xl outline-none focus:border-red-600 transition-all text-center tabular-nums" />
                </div>

                <button disabled={actionLoading} onClick={addHawk} className="w-full py-6 bg-red-600 text-white font-black rounded-[2rem] uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all">
                  {actionLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Sincronizar Halcón'}
                </button>
              </div>
            </main>
          )}
        </div>
      )}
    </div>
  );
};

export default App;