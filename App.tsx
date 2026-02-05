import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Eye, EyeOff, Utensils, Calendar, Target,
  ChevronRight, Info, Activity, Minus, Check, X, Mail, ShieldCheck, 
  Loader2, AlertCircle, WifiOff, UserCircle, Scale, MessageSquare, ChevronDown
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase, IS_MOCK_MODE } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const SPECIES_OPTIONS = ['Peregrine', 'Hybrid', 'Gyrfalcon', 'Lanner', 'Saker'];

const FOOD_COLORS: Record<FoodCategory, { bg: string, border: string, text: string, accent: string }> = {
  'Chick': { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-900', accent: 'bg-amber-500' },
  'Pigeon': { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-900', accent: 'bg-rose-600' },
  'Quail': { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-900', accent: 'bg-orange-500' },
  'Partridge': { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-900', accent: 'bg-yellow-600' },
  'Duck': { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-900', accent: 'bg-slate-800' }
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('AUTH');
  const [user, setUser] = useState<any>(null);
  const [hawks, setHawks] = useState<Hawk[]>([]);
  const [selectedHawkId, setSelectedHawkId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  
  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Falcon states
  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');

  // Entry states
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
          foodSelections: e.food_selections || e.foodSelections || [],
          notes: e.notes || ''
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      setHawks(formattedHawks);
    } catch (e: any) {
      setDataError("Error de sincronización.");
    }
  };

  const handleAuth = async (action: 'LOGIN' | 'SIGNUP' | 'RECOVER' | 'GUEST') => {
    if (actionLoading) return;
    setActionLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    
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
        if (!email || !password) throw new Error("Por favor, rellena todos los campos.");
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setAuthSuccessMsg("¡Cuenta creada! Revisa tu email para confirmar.");
        }
      } else if (action === 'RECOVER') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setAuthSuccessMsg("Instrucciones enviadas.");
      }
    } catch (e: any) {
      const errorMsg = e.message || "Error de red o servidor";
      setAuthError(errorMsg.includes('rate limit') ? "Demasiados intentos. Usa el 'Modo Invitado'." : errorMsg);
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
      const { error } = await supabase.from('entries').insert([{ 
        hawk_id: selectedHawkId, 
        weight_before: parseFloat(weightBefore), 
        total_food_weight: totalFoodWeight, 
        food_selections: currentFoodSelections, 
        notes: entryNotes,
        date: new Date().toISOString() 
      }]);
      if (error) throw error;
      await loadData(user.id);
      setWeightBefore(''); setEntryNotes(''); setCurrentFoodSelections([]); setView('HAWK_DETAILS');
    } catch(e: any) {
        alert("Error al guardar: " + (e.message || "Error desconocido"));
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
        alert("Error: " + (e.message || "No se pudo crear el halcón"));
    } finally { setActionLoading(false); }
  };

  const getWeightStatus = (current: number, target: number) => {
    const diff = current - target;
    if (Math.abs(diff) <= 10) return { label: 'PESO IDEAL', color: 'bg-green-500', text: 'text-green-500' };
    if (diff > 10) return { label: 'ALTO', color: 'bg-amber-500', text: 'text-amber-500' };
    return { label: 'BAJO', color: 'bg-red-500', text: 'text-red-500' };
  };

  // Auth Screen Render
  if (!user && (view === 'AUTH' || view === 'SIGNUP' || view === 'RECOVER')) {
    return (
      <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-sm mx-auto w-full font-inter animate-in fade-in zoom-in duration-500 bg-white md:rounded-[3rem] md:shadow-2xl md:my-8 md:border md:border-slate-100">
        <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-700 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-red-200">
          <Bird className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black mb-1 uppercase italic tracking-tighter text-slate-900">FALCON <span className="text-red-600">PRO</span></h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-12">PROFESSIONAL TRACKER</p>
        
        <div className="w-full space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors" size={18} />
            <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 focus:bg-white font-bold uppercase text-xs transition-all" />
          </div>
          
          {view !== 'RECOVER' && (
            <div className="relative group">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors" size={18} />
              <input type={showPassword ? "text" : "password"} placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 focus:bg-white font-bold uppercase text-xs transition-all" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-600 transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {authError && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[11px] font-bold uppercase flex items-center gap-2 text-left border border-red-100 animate-shake"><AlertCircle size={16}/> {authError}</div>}
          {authSuccessMsg && <div className="p-4 bg-green-50 text-green-700 rounded-2xl text-[11px] font-bold uppercase flex items-center gap-2 text-left animate-in fade-in slide-in-from-top-2"><Check size={16}/> {authSuccessMsg}</div>}

          <button disabled={actionLoading} onClick={() => handleAuth(view === 'SIGNUP' ? 'SIGNUP' : (view === 'RECOVER' ? 'RECOVER' : 'LOGIN'))} 
            className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-200 border-b-4 border-red-800 flex items-center justify-center gap-2 uppercase tracking-widest active:translate-y-1 hover:brightness-110 transition-all">
            {actionLoading ? <Loader2 className="animate-spin" /> : (view === 'SIGNUP' ? 'Crear Cuenta' : (view === 'RECOVER' ? 'Recuperar' : 'Entrar'))}
          </button>
          
          <div className="relative py-4">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
             <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest"><span className="bg-white px-3 text-slate-300">MODO INVITADO</span></div>
          </div>

          <button onClick={() => handleAuth('GUEST')} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest active:scale-95 hover:bg-slate-800 transition-all">
            <UserCircle size={18} className="text-red-500" /> Acceso Rápido (Local)
          </button>
          
          <div className="pt-4 flex flex-col gap-3">
            {view === 'AUTH' ? (
              <button onClick={() => setView('SIGNUP')} className="text-slate-400 text-[10px] font-black uppercase hover:text-slate-600 transition-colors">¿Eres nuevo? <span className="text-slate-900 underline">Crea tu perfil</span></button>
            ) : (
              <button onClick={() => setView('AUTH')} className="text-slate-400 text-[10px] font-black uppercase hover:text-slate-600 transition-colors">Ya tengo cuenta. <span className="text-slate-900 underline">Volver</span></button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-6xl mx-auto bg-slate-50 overflow-hidden md:rounded-[3rem] relative md:shadow-2xl md:my-6 border border-slate-100 font-inter">
      {user && (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
          {IS_MOCK_MODE && <div className="bg-slate-900 text-red-500 text-[9px] py-1.5 text-center font-black uppercase tracking-[0.2em] z-20">GUEST MODE · DATA IS LOCAL ONLY</div>}
          {dataError && <div className="bg-amber-500 text-white text-[10px] py-2 text-center font-black uppercase flex items-center justify-center gap-2"><WifiOff size={14}/> Error de red. Intentando reconectar...</div>}
          
          {view === 'DASHBOARD' && (
            <>
              <header className="p-8 md:p-12 flex justify-between items-end border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-xl z-10">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <Bird className="text-red-600" size={32} />
                    <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-slate-900">PANEL <span className="text-red-600 text-opacity-80">CENTRAL</span></h2>
                  </div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">{hawks.length} HALCONES ACTIVOS EN TEMPORADA</p>
                </div>
                <button onClick={() => setView('ADD_HAWK')} className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-red-200 border-b-4 border-red-800 active:scale-95 hover:bg-red-500 transition-all"><Plus size={36}/></button>
              </header>

              <main className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hawks.map(h => {
                    const lastEntry = h.entries[0];
                    const status = lastEntry ? getWeightStatus(lastEntry.weightBefore, h.targetWeight) : null;
                    return (
                      <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="group relative p-8 bg-white border border-slate-100 rounded-[2.5rem] cursor-pointer hover:border-red-600 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-300 overflow-hidden active:scale-95">
                        <div className="absolute top-0 right-0 p-4">
                           {status && <span className={`${status.color} text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg`}>{status.label}</span>}
                        </div>
                        <div className="flex flex-col gap-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all duration-300"><Bird size={32}/></div>
                            <div>
                              <h3 className="font-black text-2xl text-slate-900 group-hover:text-red-600 transition-colors uppercase">{h.name}</h3>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{h.species}</p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">PESO OBJETIVO</p>
                              <div className="flex items-center gap-1.5 font-black text-slate-400">
                                <Target size={14} />
                                <span className="text-xl">{h.targetWeight}g</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ACTUAL</p>
                              <div className="flex items-end gap-1">
                                <span className="text-4xl font-black text-slate-900 leading-none">{lastEntry?.weightBefore || '--'}</span>
                                <span className="text-xs font-black text-slate-300 mb-1">g</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {hawks.length === 0 && (
                  <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                    <div className="p-10 bg-slate-50 rounded-full mb-6"><Bird size={80} className="opacity-20" /></div>
                    <p className="text-[12px] font-black uppercase tracking-[0.4em]">Registra tu primer halcón para comenzar</p>
                  </div>
                )}

                <div className="pt-16 pb-12 flex flex-col items-center gap-6 border-t border-slate-50">
                  <button onClick={() => supabase.auth.signOut()} className="group px-10 py-4 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 rounded-2xl text-[11px] font-black uppercase flex items-center gap-3 transition-all shadow-sm">
                    <LogOut size={16} className="group-hover:translate-x-1 transition-transform" /> {IS_MOCK_MODE ? 'FINALIZAR SESIÓN INVITADO' : 'CERRAR SESIÓN'}
                  </button>
                  <p className="text-[10px] font-black text-slate-200 uppercase tracking-[0.5em] italic">FALCON WEIGHT PRO · v2.1 ELITE</p>
                </div>
              </main>
            </>
          )}

          {view === 'HAWK_DETAILS' && selectedHawk && (
            <>
              <header className="p-8 md:p-12 flex justify-between items-center border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-xl z-20">
                <button onClick={() => setView('DASHBOARD')} className="w-14 h-14 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 transition-colors"><ChevronLeft size={28}/></button>
                <div className="text-center">
                  <h2 className="font-black text-3xl md:text-4xl italic uppercase tracking-tighter text-slate-900">{selectedHawk.name}</h2>
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">{selectedHawk.species}</p>
                </div>
                <button onClick={async () => { if(confirm('¿Seguro que deseas eliminar este halcón de la base de datos?')) { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); }}} className="w-14 h-14 bg-red-50 hover:bg-red-600 hover:text-white rounded-2xl flex items-center justify-center text-red-500 transition-all"><Trash2 size={24}/></button>
              </header>

              <main className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 no-scrollbar pb-36">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                     <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700"><Bird size={240} /></div>
                     <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
                       <div className="space-y-6 w-full md:w-auto">
                         <div>
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">PESO ACTUAL REGISTRADO</p>
                           <p className="text-7xl md:text-8xl font-black leading-none tabular-nums">{selectedHawk.entries[0]?.weightBefore || '---'}<span className="text-2xl font-bold ml-2 text-red-500">g</span></p>
                         </div>
                         <div className="flex items-center gap-6 pt-4">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">OBJETIVO: {selectedHawk.targetWeight}g</span>
                           </div>
                         </div>
                       </div>
                       <div className="w-full md:w-1/2 h-32 md:h-40 bg-white/5 rounded-3xl p-4 backdrop-blur-sm">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <Area type="monotone" dataKey="weight" stroke="#dc2626" strokeWidth={3} fill="#dc2626" fillOpacity={0.1} />
                            </AreaChart>
                          </ResponsiveContainer>
                       </div>
                     </div>
                   </div>
                   
                   <div className="bg-white border border-slate-100 p-10 rounded-[3rem] shadow-xl flex flex-col justify-center gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">VARIACIÓN ÚLTIMO VUELO</p>
                        <p className="text-3xl font-black text-center text-slate-900">
                          {selectedHawk.entries.length > 1 
                            ? (selectedHawk.entries[0].weightBefore - selectedHawk.entries[1].weightBefore > 0 ? '+' : '') + (selectedHawk.entries[0].weightBefore - selectedHawk.entries[1].weightBefore)
                            : '0'}
                          <span className="text-sm ml-1 text-slate-300">g</span>
                        </p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1 text-center">GORDURA COMIDA HOY</p>
                        <p className="text-3xl font-black text-center text-red-600">+{selectedHawk.entries[0]?.totalFoodWeight || 0}<span className="text-sm ml-1">g</span></p>
                      </div>
                   </div>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">HISTORIAL DE RENDIMIENTO</h3>
                    <div className="w-24 h-1 bg-slate-100 rounded-full"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedHawk.entries.slice(0, 8).map(e => (
                      <div key={e.id} className="p-6 bg-white border border-slate-100 rounded-[2.5rem] flex flex-col gap-4 hover:border-slate-200 hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-900 font-black"><Scale size={18}/></div>
                             <div>
                               <p className="text-2xl font-black text-slate-900">{e.weightBefore}<span className="text-xs text-slate-300 ml-1">g</span></p>
                               <p className="text-[9px] font-bold text-red-600 uppercase tracking-tighter">COMIDA: +{e.totalFoodWeight}g</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(e.date).toLocaleDateString()}</p>
                             <p className="text-[9px] font-bold text-slate-200 uppercase">{new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        {e.notes && (
                          <div className="p-4 bg-slate-50 rounded-2xl flex gap-3 items-start border border-slate-100">
                            <MessageSquare size={14} className="text-slate-300 mt-1 shrink-0" />
                            <p className="text-[11px] italic text-slate-600 leading-relaxed font-medium">{e.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </main>

              <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-center z-30 pointer-events-none">
                <button onClick={() => setView('ADD_ENTRY')} className="group w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-2xl shadow-red-200 uppercase tracking-[0.2em] border-b-4 border-red-800 active:translate-y-1 hover:bg-red-500 transition-all pointer-events-auto flex items-center justify-center gap-3">
                  <Scale size={20} className="group-hover:rotate-12 transition-transform" /> REGISTRAR DÍA
                </button>
              </div>
            </>
          )}

          {view === 'ADD_ENTRY' && (
            <main className="p-8 md:p-12 space-y-10 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-36 animate-in slide-in-from-bottom-10 duration-500">
              <div className="flex justify-between items-center">
                <button onClick={() => setView('HAWK_DETAILS')} className="w-14 h-14 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 transition-colors"><ChevronLeft size={28}/></button>
                <div className="text-center">
                  <h2 className="font-black text-2xl italic uppercase tracking-tighter text-slate-900">REGISTRO <span className="text-red-600">DIARIO</span></h2>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
                </div>
                <div className="w-14"></div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-10">
                <div className="flex-1 space-y-8">
                  <div className="text-center space-y-4">
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">PESO ANTES DE COMER (g)</p>
                    <div className="relative inline-block w-full">
                      <input 
                        value={weightBefore} 
                        onChange={e => setWeightBefore(e.target.value)} 
                        type="number" 
                        placeholder="000" 
                        className="w-full text-center text-8xl md:text-9xl font-black outline-none tabular-nums text-slate-900 placeholder:text-slate-100 bg-transparent caret-red-600" 
                        autoFocus
                      />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-red-600 rounded-full opacity-20"></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] ml-4">OBSERVACIONES DE VUELO</p>
                    <div className="relative group">
                      <MessageSquare className="absolute left-6 top-6 text-slate-300 group-focus-within:text-red-600 transition-colors" size={20} />
                      <textarea 
                        value={entryNotes} 
                        onChange={e => setEntryNotes(e.target.value)} 
                        placeholder="Describe cómo ha volado, apetencia, actitud..." 
                        className="w-full h-32 p-6 pl-16 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] outline-none focus:border-red-600 focus:bg-white font-medium text-slate-600 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="bg-slate-900 text-white p-8 rounded-[3rem] flex justify-between items-center border-b-8 border-slate-800 shadow-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white"><Utensils size={24} /></div>
                      <div>
                        <span className="font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">GORGA TOTAL</span>
                        <p className="text-[9px] font-bold text-red-500 uppercase">CALCUALDO AUTOMÁTICO</p>
                      </div>
                    </div>
                    <span className="text-6xl font-black text-white tabular-nums">{totalFoodWeight}<span className="text-xl ml-2 text-slate-500">g</span></span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                      <div key={cat} className={`${FOOD_COLORS[cat].bg} p-6 rounded-[2.5rem] border border-transparent hover:border-slate-200 transition-all space-y-4`}>
                        <div className="flex justify-between items-center">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${FOOD_COLORS[cat].text}`}>{cat}</p>
                        </div>
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
                               }} className="group bg-white p-4 rounded-2xl border border-slate-200 relative flex flex-col items-center active:scale-90 hover:border-red-500 transition-all shadow-sm">
                                 <span className="text-[8px] font-black uppercase text-slate-300 group-hover:text-red-600 transition-colors mb-1">{por}</span>
                                 <span className="font-black text-lg text-slate-900">{FOOD_WEIGHT_MAP[cat][por]}g</span>
                                 {qty > 0 && (
                                   <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full text-[11px] flex items-center justify-center font-black border-4 border-white shadow-lg animate-in zoom-in">{qty}</div>
                                 )}
                                 {qty > 0 && (
                                   <div onClick={(e) => {
                                     e.stopPropagation();
                                     setCurrentFoodSelections(prev => prev.map(f => f.id === sel?.id ? {...f, quantity: Math.max(0, f.quantity - 1)} : f).filter(f => f.quantity > 0));
                                   }} className="absolute -bottom-2 -left-2 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-md active:scale-75 transition-transform"><Minus size={12}/></div>
                                 )}
                               </button>
                             );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-center z-30 pointer-events-none">
                <button 
                  disabled={!weightBefore || actionLoading} 
                  onClick={saveEntry} 
                  className="w-full max-w-sm py-6 bg-red-600 disabled:bg-slate-200 text-white font-black rounded-[2.5rem] shadow-2xl shadow-red-200 uppercase tracking-[0.3em] border-b-4 border-red-800 flex items-center justify-center gap-3 active:translate-y-1 hover:brightness-110 transition-all pointer-events-auto"
                >
                  {actionLoading ? <Loader2 className="animate-spin" /> : <><Check size={24} /> FINALIZAR SESIÓN</>}
                </button>
              </div>
            </main>
          )}

          {view === 'ADD_HAWK' && (
            <main className="p-8 md:p-12 space-y-12 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-32 animate-in slide-in-from-right-10 duration-500">
              <div className="flex items-center gap-6">
                <button onClick={() => setView('DASHBOARD')} className="w-14 h-14 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 transition-colors"><ChevronLeft size={28}/></button>
                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-900">ALTA <span className="text-red-600">HALCÓN</span></h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] ml-6">NOMBRE DEL AVE</label>
                  <div className="relative group">
                    <Bird className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors" size={24} />
                    <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: Rayo del Norte" className="w-full p-6 pl-16 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-black text-xl outline-none focus:border-red-600 focus:bg-white transition-all" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] ml-6">ESPECIE / HÍBRIDO</label>
                  <div className="relative">
                    <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-black text-xl outline-none uppercase appearance-none focus:border-red-600 focus:bg-white transition-all">
                      {SPECIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-red-600 pointer-events-none" size={24} />
                  </div>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] ml-6">PESO DE VUELO IDEAL (GRAMOS)</label>
                  <div className="relative group">
                    <Target className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors" size={24} />
                    <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Ej: 950" className="w-full p-6 pl-16 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-black text-4xl outline-none focus:border-red-600 focus:bg-white transition-all text-center tabular-nums" />
                  </div>
                </div>
              </div>
              
              <button disabled={actionLoading} onClick={addHawk} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2.5rem] mt-auto uppercase tracking-[0.3em] border-b-4 border-red-800 active:translate-y-1 hover:brightness-110 transition-all mx-auto flex items-center justify-center gap-3 shadow-2xl shadow-red-200">
                {actionLoading ? <Loader2 className="animate-spin" /> : <><Check size={24}/> GUARDAR HALCÓN</>}
              </button>
            </main>
          )}
        </div>
      )}
    </div>
  );
};

export default App;