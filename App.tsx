
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
  
  // Estados de carga no bloqueantes
  const [actionLoading, setActionLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Estados de Autenticación
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Estados de Halcones
  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTargetWeight, setTempTargetWeight] = useState('');

  // Estados de Registro Diario
  const [weightBefore, setWeightBefore] = useState('');
  const [currentFoodSelections, setCurrentFoodSelections] = useState<FoodSelection[]>([]);

  const selectedHawk = useMemo(() => 
    hawks.find(h => h.id === selectedHawkId) || null
  , [hawks, selectedHawkId]);

  // Fix: Added missing chartData variable derived from selected hawk entries to resolve error on line 352
  const chartData = useMemo(() => {
    if (!selectedHawk || !selectedHawk.entries) return [];
    return [...selectedHawk.entries]
      .slice(0, 10)
      .reverse()
      .map(e => ({
        date: new Date(e.date).toLocaleDateString(),
        weight: e.weightBefore
      }));
  }, [selectedHawk]);

  useEffect(() => {
    // Avisamos al index.html que React ya está listo
    window.dispatchEvent(new CustomEvent('app-ready'));

    // Configurar listener de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event Update:", event);
      if (session) {
        setUser(session.user);
        setView('DASHBOARD');
        loadData(session.user.id);
      } else {
        setUser(null);
        if (view !== 'SIGNUP' && view !== 'RECOVER') setView('AUTH');
        setHawks([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId: string) => {
    if (IS_MOCK_MODE) {
      const local = localStorage.getItem(`falcon_db_${userId}`);
      if (local) setHawks(JSON.parse(local));
      return;
    }

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
      console.error("Database Load Error:", e);
      setDataError("Error al sincronizar con la nube.");
    }
  };

  const handleAuth = async (action: 'LOGIN' | 'SIGNUP' | 'RECOVER') => {
    setActionLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      if (action === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (action === 'SIGNUP') {
        if (!email || !password) throw new Error("Completa todos los campos.");
        if (password.length < 6) throw new Error("Contraseña de min. 6 caracteres.");
        
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        
        if (error) throw error;
        
        if (data.user && !data.session) {
          setAuthSuccessMsg("¡Éxito! Confirma tu email para poder entrar.");
        } else {
          setAuthSuccessMsg("¡Bienvenido! Entrando...");
        }
      } else if (action === 'RECOVER') {
        if (!email) throw new Error("Introduce tu email.");
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setAuthSuccessMsg("Enviado. Revisa tu bandeja de entrada.");
      }
    } catch (e: any) {
      console.error("Auth Exception:", e);
      setAuthError(e.message || "Fallo en la conexión");
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
    const month = new Date().getMonth();
    let seasonalFactor = ([11, 0, 1].includes(month)) ? 1.15 : ([5, 6, 7].includes(month) ? 0.90 : 1.0);
    const lastEntry = hawk.entries[0];
    return Math.round((lastEntry.weightBefore + lastEntry.totalFoodWeight) - (avgLoss * seasonalFactor));
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
    const newWeight = parseFloat(weightBefore);
    try {
      if (IS_MOCK_MODE) {
        const entryData = { id: Math.random().toString(), date: new Date().toISOString(), weightBefore: newWeight, totalFoodWeight, foodSelections: currentFoodSelections };
        const updatedHawks = hawks.map(h => h.id === selectedHawkId ? { ...h, entries: [entryData, ...h.entries] } : h);
        setHawks(updatedHawks);
        localStorage.setItem(`falcon_db_${user.id}`, JSON.stringify(updatedHawks));
      } else {
        await supabase.from('entries').insert([{ hawk_id: selectedHawkId, weight_before: newWeight, total_food_weight: totalFoodWeight, food_selections: currentFoodSelections, date: new Date().toISOString() }]);
        await loadData(user.id);
      }
      setWeightBefore(''); setCurrentFoodSelections([]); setView('HAWK_DETAILS');
    } finally { setActionLoading(false); }
  };

  const addHawk = async () => {
    if (!hawkName || !hawkTargetWeight || !user) return;
    setActionLoading(true);
    try {
      const targetW = parseFloat(hawkTargetWeight);
      if (IS_MOCK_MODE) {
        const newHawk: Hawk = { id: Math.random().toString(36).substr(2, 9), name: hawkName, species: hawkSpecies, targetWeight: targetW, entries: [] };
        const updated = [...hawks, newHawk];
        setHawks(updated);
        localStorage.setItem(`falcon_db_${user.id}`, JSON.stringify(updated));
      } else {
        await supabase.from('hawks').insert([{ name: hawkName, species: hawkSpecies, target_weight: targetW, user_id: user.id }]);
        await loadData(user.id);
      }
      setHawkName(''); setHawkTargetWeight(''); setView('DASHBOARD');
    } finally { setActionLoading(false); }
  };

  const isAuthView = (view === 'AUTH' || view === 'SIGNUP' || view === 'RECOVER') && !user;

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white text-slate-900 overflow-hidden md:shadow-2xl md:my-4 md:rounded-[2.5rem] relative border-x border-slate-100 font-inter">
      
      {/* Auth Views */}
      {isAuthView && (
        <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-sm mx-auto w-full animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-red-600 rounded-[1.8rem] flex items-center justify-center mb-6 shadow-2xl shadow-red-600/40 transform -rotate-6">
            <Bird className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-1 tracking-tighter uppercase italic">FALCON WEIGHT <span className="text-red-600">PRO</span></h1>
          <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.5em] mb-10">CONTROL DE PESO DIARIO</p>
          
          <div className="w-full space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold" />
              </div>
              {view !== 'RECOVER' && (
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type={showPassword ? "text" : "password"} placeholder="CONTRASEÑA" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}
            </div>

            {authError && (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3 text-left">
                <AlertCircle className="text-red-600 shrink-0" size={18} />
                <p className="text-[10px] font-bold text-red-600 uppercase leading-relaxed">{authError}</p>
              </div>
            )}

            {authSuccessMsg && (
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-start gap-3 text-left">
                <Check className="text-green-600 shrink-0" size={18} />
                <p className="text-[10px] font-bold text-green-600 uppercase leading-relaxed">{authSuccessMsg}</p>
              </div>
            )}

            <div className="pt-2">
              <button 
                disabled={actionLoading}
                onClick={() => handleAuth(view === 'SIGNUP' ? 'SIGNUP' : (view === 'RECOVER' ? 'RECOVER' : 'LOGIN'))} 
                className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 text-lg tracking-widest uppercase border-b-4 border-red-800 active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : (view === 'SIGNUP' ? 'Crear Cuenta' : (view === 'RECOVER' ? 'Recuperar' : 'Entrar'))}
              </button>
              
              <div className="mt-6 flex flex-col gap-3">
                {view === 'AUTH' ? (
                  <>
                    <button onClick={() => setView('SIGNUP')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest">¿No tienes cuenta? <span className="text-slate-900 underline">Regístrate</span></button>
                    <button onClick={() => setView('RECOVER')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest italic opacity-60">¿Olvidaste la contraseña?</button>
                  </>
                ) : (
                  <button onClick={() => setView('AUTH')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Volver al login</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main App Content */}
      {user && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-700">
          
          {dataError && (
            <div className="bg-amber-500 text-white p-2 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] animate-pulse">
              <WifiOff size={12} /> {dataError}
            </div>
          )}

          {view === 'DASHBOARD' && (
            <>
              <header className="p-8 flex justify-between items-center border-b border-slate-50 bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic">Mis <span className="text-red-600">Halcones</span></h2>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">{hawks.length} registrados</p>
                </div>
                <button onClick={() => setView('ADD_HAWK')} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl border-b-4 border-red-800 active:scale-95 transition-all"><Plus size={32}/></button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">
                {hawks.map(h => {
                  const est = calculatePrediction(h);
                  return (
                    <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="group bg-white border-2 border-slate-50 p-6 rounded-[3rem] shadow-sm hover:border-red-600 transition-all cursor-pointer flex flex-col md:flex-row justify-between md:items-center">
                      <div className="flex items-center gap-5 mb-4 md:mb-0">
                        <div className="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-red-600 group-hover:text-white rounded-3xl flex items-center justify-center shrink-0 transition-colors"><Bird size={32}/></div>
                        <div>
                          <h3 className="font-black text-2xl tracking-tighter truncate">{h.name}</h3>
                          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">{h.species}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                         <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Vuelo</p><p className="font-black">{h.targetWeight}g</p></div>
                         <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Peso</p><p className="font-black text-red-600">{h.entries[0]?.weightBefore || '--'}g</p></div>
                         <div className="text-center bg-slate-900 rounded-2xl p-2 px-3"><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Est.</p><p className="font-black text-white">{est || '--'}g</p></div>
                      </div>
                    </div>
                  );
                })}
                {hawks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-200"><Bird size={48} className="opacity-20 mb-4" /><p className="text-xs font-black uppercase tracking-widest">Sin halcones</p></div>
                )}
                <div className="pt-10 flex justify-center"><button onClick={() => supabase.auth.signOut()} className="text-slate-300 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-red-600 transition-colors"><LogOut size={14}/> Cerrar sesión</button></div>
              </main>
            </>
          )}

          {view === 'HAWK_DETAILS' && selectedHawk && (
            <>
              <header className="p-8 flex justify-between items-center border-b border-slate-50 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
                  <h2 className="font-black text-2xl uppercase italic tracking-tighter">{selectedHawk.name}</h2>
                </div>
                <button disabled={actionLoading} onClick={async () => { if(confirm('¿Eliminar halcón?')) { setActionLoading(true); try { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); } finally { setActionLoading(false); } } }} className="w-12 h-12 bg-slate-50 text-slate-200 hover:text-red-600 rounded-2xl flex items-center justify-center">{actionLoading ? <Loader2 className="animate-spin" /> : <Trash2 size={20}/>}</button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-40">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-red-600 p-8 rounded-[3rem] text-white shadow-xl shadow-red-600/20 border-b-8 border-red-800">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Peso Actual</p>
                     <p className="text-5xl font-black leading-none">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-sm font-bold ml-1">g</span></p>
                   </div>
                   <div className="bg-slate-900 p-8 rounded-[3rem] text-white border-b-8 border-slate-800 flex flex-col justify-between">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Ideal Vuelo</p>
                     <p className="text-5xl font-black leading-none">{selectedHawk.targetWeight}<span className="text-sm font-bold ml-1">g</span></p>
                   </div>
                </div>
                <div className="bg-white rounded-[3rem] border-2 border-slate-50 p-6">
                   <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Evolución Semanal</h4>
                   <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <XAxis dataKey="date" hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="weight" stroke="#dc2626" strokeWidth={4} fill="#dc2626" fillOpacity={0.1} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Historial</h4>
                  {selectedHawk.entries.map(e => (
                    <div key={e.id} className="bg-white border-2 border-slate-50 p-6 rounded-[2.5rem] flex items-center justify-between">
                      <div><p className="text-xl font-black">{e.weightBefore}g</p><p className="text-[10px] font-black text-red-600 uppercase tracking-widest">+{e.totalFoodWeight}g comida</p></div>
                      <div className="text-right text-[10px] font-bold text-slate-300 uppercase italic">{new Date(e.date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </main>
              <div className="fixed bottom-10 left-0 right-0 px-8 flex justify-center z-20">
                <button onClick={() => setView('ADD_ENTRY')} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-2xl flex items-center justify-center gap-3 text-lg uppercase tracking-widest border-b-4 border-red-800 italic">
                  <Plus size={24} /> Registrar Peso
                </button>
              </div>
            </>
          )}

          {view === 'ADD_ENTRY' && (
            <main className="flex-1 flex flex-col p-8 space-y-8 bg-white overflow-y-auto no-scrollbar pb-32">
              <div className="flex items-center justify-between">
                <button onClick={() => setView('HAWK_DETAILS')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Peso <span className="text-red-600">Hoy</span></h2>
                <div className="w-12"></div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Peso Antes de Comer (g)</p>
                <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000" className="w-full bg-transparent border-none font-black text-center text-8xl outline-none text-slate-900 placeholder:text-slate-100 tabular-nums" autoFocus />
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center px-6 bg-slate-900 py-5 rounded-[2rem] text-white">
                  <div className="flex items-center gap-2"><Utensils size={18} className="text-red-500" /><h3 className="text-[11px] font-black uppercase tracking-widest">Total Comida</h3></div>
                  <div className="text-3xl font-black text-red-500">{totalFoodWeight}g</div>
                </div>
                <div className="space-y-6">
                  {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                    <div key={cat} className={`${FOOD_COLORS[cat].bg} border-2 ${FOOD_COLORS[cat].border} p-5 rounded-[2.5rem] space-y-4`}>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${FOOD_COLORS[cat].text}`}>{cat}</p>
                      <div className="grid grid-cols-2 gap-3">
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
                            }} className={`relative w-full bg-white border-2 ${FOOD_COLORS[cat].border} p-4 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-all`}>
                              <span className="text-[10px] font-black uppercase opacity-60">{por}</span>
                              <span className="text-lg font-black">{FOOD_WEIGHT_MAP[cat][por]}g</span>
                              {qty > 0 && <div className={`absolute -top-2 -right-2 w-8 h-8 ${FOOD_COLORS[cat].badge} text-white rounded-full flex items-center justify-center text-xs font-black border-2 border-white`}>{qty}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="fixed bottom-8 left-0 right-0 px-8 flex justify-center z-20">
                <button disabled={!weightBefore || actionLoading} onClick={saveEntry} className="w-full max-sm py-6 bg-red-600 disabled:bg-slate-200 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-widest border-b-4 border-red-800 transition-all text-lg italic flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="animate-spin" /> : 'Finalizar Registro'}
                </button>
              </div>
            </main>
          )}

          {view === 'ADD_HAWK' && (
            <main className="p-8 space-y-8 flex-1 flex flex-col bg-white animate-in slide-in-from-right-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Nuevo <span className="text-red-600">Halcón</span></h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Nombre</label><input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: Ártico" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Especie</label><select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none uppercase">{SPECIES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Peso de Vuelo (g)</label><input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Ej: 850" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none text-red-600" /></div>
              </div>
              <button disabled={actionLoading} onClick={addHawk} className="w-full py-6 bg-red-600 text-white font-black rounded-[2rem] mt-auto uppercase tracking-widest border-b-4 border-red-800 italic text-lg active:scale-95 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Halcón'}
              </button>
            </main>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
