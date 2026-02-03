import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Eye, EyeOff, Utensils, Calendar, Target,
  ChevronRight, Info, Activity, Minus, Check, X, Mail, ShieldCheck, Loader2, AlertCircle
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase, IS_MOCK_MODE } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine
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
  
  const [initialLoading, setInitialLoading] = useState(true);
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

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTargetWeight, setTempTargetWeight] = useState('');

  const [weightBefore, setWeightBefore] = useState('');
  const [currentFoodSelections, setCurrentFoodSelections] = useState<FoodSelection[]>([]);

  const selectedHawk = useMemo(() => 
    hawks.find(h => h.id === selectedHawkId) || null
  , [hawks, selectedHawkId]);

  useEffect(() => {
    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Supabase Auth Event:", event);
      
      if (session) {
        setUser(session.user);
        setView('DASHBOARD');
        // Cargamos los datos sin bloquear la UI
        loadData(session.user.id);
      } else {
        setUser(null);
        // Solo resetear vista si no estamos en registro o recuperación
        if (view !== 'SIGNUP' && view !== 'RECOVER') setView('AUTH');
        setHawks([]);
      }
      
      // QUITAMOS EL LOADING SIEMPRE que Supabase nos responda algo
      setInitialLoading(false);
    });

    // Timeout de seguridad extremo (3 segundos)
    const timer = setTimeout(() => setInitialLoading(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
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
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "hawks" does not exist')) {
          setDataError("Error: Las tablas no existen en Supabase. Por favor, créalas.");
        }
        throw error;
      }
      
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
      console.error("Data load error:", e);
    }
  };

  const saveDataLocally = (newHawks: Hawk[]) => {
    setHawks(newHawks);
    if (user) localStorage.setItem(`falcon_db_${user.id}`, JSON.stringify(newHawks));
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
        if (!email || !password) throw new Error("Email y contraseña requeridos.");
        if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
        
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user && !data.session) {
          setAuthSuccessMsg("¡Cuenta creada! Revisa tu email para confirmarla.");
        } else {
          setAuthSuccessMsg("¡Registro completado!");
        }
      } else if (action === 'RECOVER') {
        if (!email) throw new Error("Introduce tu email.");
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setAuthSuccessMsg("Enlace de recuperación enviado.");
      }
    } catch (e: any) {
      setAuthError(e.message || "Error en la operación");
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
    setActionLoading(true);
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
      setActionLoading(false);
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
      setActionLoading(false);
    }
  };

  const updateTargetWeight = async () => {
    if (!selectedHawkId || !tempTargetWeight || !user) return;
    setActionLoading(true);
    const newWeight = parseFloat(tempTargetWeight);
    
    if (IS_MOCK_MODE) {
      const updatedHawks = hawks.map(h => h.id === selectedHawkId ? { ...h, targetWeight: newWeight } : h);
      saveDataLocally(updatedHawks);
      setIsEditingTarget(false);
      setActionLoading(false);
      return;
    }

    try {
      await supabase.from('hawks').update({ target_weight: newWeight }).eq('id', selectedHawkId);
      await loadData(user.id);
      setIsEditingTarget(false);
    } finally {
      setActionLoading(false);
    }
  };

  const addHawk = async () => {
    if (!hawkName || !hawkTargetWeight || !user) return;
    setActionLoading(true);
    const targetW = parseFloat(hawkTargetWeight);
    if (IS_MOCK_MODE) {
      const newHawkId = Math.random().toString(36).substr(2, 9);
      const hawkData: Hawk = { id: newHawkId, name: hawkName, species: hawkSpecies, targetWeight: targetW, entries: [] };
      saveDataLocally([...hawks, hawkData]);
      setHawkName(''); setHawkTargetWeight(''); setView('DASHBOARD');
      setActionLoading(false);
      return;
    }
    try {
      await supabase.from('hawks').insert([{ name: hawkName, species: hawkSpecies, target_weight: targetW, user_id: user.id }]);
      await loadData(user.id);
      setHawkName(''); setHawkTargetWeight(''); setView('DASHBOARD');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteHawkItem = async (id: string) => {
    if (!user) return;
    setActionLoading(true);
    if (IS_MOCK_MODE) {
      saveDataLocally(hawks.filter(h => h.id !== id));
      setView('DASHBOARD'); setSelectedHawkId(null);
      setActionLoading(false);
      return;
    }
    try {
      await supabase.from('hawks').delete().eq('id', id);
      await loadData(user.id);
      setView('DASHBOARD'); setSelectedHawkId(null);
    } finally {
      setActionLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!selectedHawk) return [];
    return [...selectedHawk.entries].reverse().map(e => ({
      date: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      weight: e.weightBefore,
      food: e.totalFoodWeight
    }));
  }, [selectedHawk]);

  const isAuthView = view === 'AUTH' || view === 'SIGNUP' || view === 'RECOVER';

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white text-slate-900 overflow-hidden md:shadow-2xl md:my-4 md:rounded-[2.5rem] relative border-x border-slate-100 font-inter">
      {IS_MOCK_MODE && (
        <div className="bg-amber-100 text-amber-800 text-[8px] font-black text-center py-1.5 uppercase tracking-[0.3em] border-b border-amber-200 z-50">
          Modo Demo: Sin conexión real (Usa llaves válidas para sincronizar)
        </div>
      )}
      
      {initialLoading && !user && (
        <div className="absolute inset-0 bg-white z-[100] flex flex-col items-center justify-center">
          <div className="spinner"></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-red-600 italic">Falcon Weight Pro</p>
        </div>
      )}

      {/* Auth Views */}
      {isAuthView && !user && (
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
                <input 
                  type="email" 
                  placeholder="EMAIL" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold" 
                />
              </div>

              {view !== 'RECOVER' && (
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="CONTRASEÑA" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold" 
                  />
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
              {view === 'AUTH' && (
                <div className="space-y-4">
                  <button 
                    disabled={actionLoading}
                    onClick={() => handleAuth('LOGIN')} 
                    className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 text-lg tracking-widest uppercase border-b-4 border-red-800 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
                  </button>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => { setView('SIGNUP'); setAuthError(null); setAuthSuccessMsg(null); }} className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-colors">¿No tienes cuenta? Regístrate</button>
                    <button onClick={() => { setView('RECOVER'); setAuthError(null); setAuthSuccessMsg(null); }} className="text-red-600/60 font-black text-[10px] uppercase tracking-widest hover:text-red-600 transition-colors italic">¿Olvidaste tu contraseña?</button>
                  </div>
                </div>
              )}

              {view === 'SIGNUP' && (
                <div className="space-y-4">
                  <button 
                    disabled={actionLoading}
                    onClick={() => handleAuth('SIGNUP')} 
                    className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 text-lg tracking-widest uppercase border-b-4 border-slate-700 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Crear Cuenta'}
                  </button>
                  <button onClick={() => { setView('AUTH'); setAuthError(null); setAuthSuccessMsg(null); }} className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-colors">Volver al Login</button>
                </div>
              )}

              {view === 'RECOVER' && (
                <div className="space-y-4">
                  <button 
                    disabled={actionLoading}
                    onClick={() => handleAuth('RECOVER')} 
                    className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 text-lg tracking-widest uppercase border-b-4 border-red-800 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Recuperar Acceso'}
                  </button>
                  <button onClick={() => { setView('AUTH'); setAuthError(null); setAuthSuccessMsg(null); }} className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-colors">Volver al Login</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* App Content (DASHBOARD, etc) */}
      {user && (
        <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-700">
          {dataError && (
            <div className="bg-red-600 text-white p-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <AlertCircle size={14} /> {dataError}
            </div>
          )}

          {view === 'DASHBOARD' && (
            <>
              <header className="p-8 flex justify-between items-center border-b border-slate-50 bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic">Mis <span className="text-red-600">Halcones</span></h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{hawks.length} Halcones</p>
                  </div>
                </div>
                <button onClick={() => setView('ADD_HAWK')} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl border-b-4 border-red-800 active:scale-95 transition-all"><Plus size={32}/></button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">
                {hawks.map(h => {
                  const estWeight = calculatePrediction(h);
                  const lastWeight = h.entries[0]?.weightBefore;
                  return (
                    <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="group bg-white border-2 border-slate-50 p-6 rounded-[3rem] flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:border-red-600 hover:shadow-xl hover:shadow-red-600/5 transition-all cursor-pointer relative overflow-hidden">
                      <div className="flex items-center gap-5 mb-6 md:mb-0">
                        <div className="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-red-600 group-hover:text-white rounded-[2rem] flex items-center justify-center transition-all shadow-inner shrink-0"><Bird size={32}/></div>
                        <div className="overflow-hidden">
                          <h3 className="font-black text-2xl tracking-tighter truncate leading-tight">{h.name}</h3>
                          <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">{h.species}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 md:gap-4 shrink-0 bg-slate-50/50 p-3 rounded-[2rem] md:p-1 md:bg-transparent">
                        <div className="text-center bg-white md:bg-transparent p-3 md:p-2 rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-slate-50 md:border-none">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Target</p>
                          <p className="text-lg font-black tabular-nums text-slate-900 leading-none">{h.targetWeight}<span className="text-[10px] ml-0.5">g</span></p>
                        </div>
                        <div className="text-center bg-white md:bg-transparent p-3 md:p-2 rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-slate-50 md:border-none border-x-0 md:border-x md:border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Last</p>
                          <p className="text-lg font-black tabular-nums text-red-600 leading-none">{lastWeight || '--'}<span className="text-[10px] ml-0.5">g</span></p>
                        </div>
                        <div className="text-center bg-slate-900 p-3 md:p-3 rounded-2xl md:rounded-[1.2rem] shadow-xl shadow-slate-900/10 min-w-[70px]">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Est.</p>
                          <p className="text-lg font-black tabular-nums text-white leading-none">{estWeight || '--'}<span className="text-[10px] ml-0.5">g</span></p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {hawks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Bird size={64} className="mb-4 opacity-20" />
                    <p className="text-xs font-black uppercase tracking-[0.3em]">Pulsa + para añadir halcón</p>
                  </div>
                )}
                <div className="pt-10 pb-6 flex justify-center">
                  <button onClick={() => supabase.auth.signOut()} className="text-slate-300 font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2 hover:text-red-600 transition-colors bg-slate-50 px-6 py-3 rounded-full">
                    <LogOut size={14}/> Cerrar Sesión
                  </button>
                </div>
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
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">HISTORIAL</p>
                  </div>
                </div>
                <button disabled={actionLoading} onClick={() => { if(confirm('¿Eliminar halcón?')) deleteHawkItem(selectedHawk.id) }} className="w-12 h-12 bg-slate-50 text-slate-200 hover:text-red-600 rounded-2xl flex items-center justify-center transition-colors">
                  {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20}/>}
                </button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-40">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-600 p-8 rounded-[3rem] text-white shadow-2xl shadow-red-600/20 border-b-8 border-red-800">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Peso Actual</p>
                    <p className="text-5xl font-black leading-none">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-sm font-bold ml-1">g</span></p>
                  </div>
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white border-b-8 border-slate-800 relative group" onClick={() => { setTempTargetWeight(selectedHawk.targetWeight.toString()); setIsEditingTarget(true); }}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Target</p>
                    <div className="flex items-end justify-between">
                      <p className="text-5xl font-black leading-none">{selectedHawk.targetWeight}<span className="text-sm font-bold ml-1">g</span></p>
                      <Plus size={16} className="text-slate-500 mb-1" />
                    </div>
                  </div>
                </div>
                {/* Editor Modal de Target */}
                {isEditingTarget && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 text-center">Editar Peso Ideal</h3>
                      <input 
                        type="number" 
                        value={tempTargetWeight} 
                        onChange={e => setTempTargetWeight(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 font-black text-4xl outline-none focus:border-red-600 text-center text-slate-900 mb-6"
                        autoFocus
                      />
                      <div className="flex gap-4">
                        <button onClick={() => setIsEditingTarget(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl uppercase tracking-widest">Cancelar</button>
                        <button onClick={updateTargetWeight} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-red-600/20">Guardar</button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-[3rem] border-2 border-slate-50 p-6 shadow-sm">
                   <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Evolución Semanal</h4>
                   <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#cbd5e1'}} />
                        <Tooltip />
                        <Area type="monotone" dataKey="weight" stroke="#dc2626" strokeWidth={4} fill="#dc2626" fillOpacity={0.1} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Registros Recientes</h4>
                  {selectedHawk.entries.length === 0 && <p className="text-center py-10 text-slate-300 text-[10px] font-black uppercase italic">Sin registros</p>}
                  {selectedHawk.entries.map(e => (
                    <div key={e.id} className="bg-white border-2 border-slate-50 p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xl font-black tabular-nums">{e.weightBefore}g</p>
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">+{e.totalFoodWeight}g comida</p>
                      </div>
                      <div className="text-right text-[10px] font-bold text-slate-300 uppercase italic">
                        {new Date(e.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </main>
              <div className="fixed bottom-10 left-0 right-0 px-8 flex justify-center z-20">
                <button onClick={() => setView('ADD_ENTRY')} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-2xl shadow-red-600/40 flex items-center justify-center gap-3 active:scale-95 transition-all text-lg uppercase tracking-[0.2em] border-b-4 border-red-800 italic">
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
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Peso Antes de Comer (g)</p>
                <input value={weightBefore} onChange={e => setWeightBefore(e.target.value)} type="number" placeholder="000" className="w-full bg-transparent border-none font-black text-center text-8xl outline-none text-slate-900 placeholder:text-slate-100 tabular-nums" autoFocus />
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center px-6 bg-slate-900 py-5 rounded-[2rem] text-white">
                  <div className="flex items-center gap-2">
                    <Utensils size={18} className="text-red-500" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest">Gramos Ingeridos</h3>
                  </div>
                  <div className="text-3xl font-black text-red-500 tabular-nums">{totalFoodWeight}g</div>
                </div>
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
                                <button onClick={() => updateFoodQuantity(cat, por, 1)} className={`w-full ${config.bg} border-2 ${config.border} ${config.hover} p-4 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95`}>
                                  <span className={`text-[10px] font-black uppercase opacity-60 ${config.text}`}>{por}</span>
                                  <span className={`text-lg font-black ${config.text}`}>{FOOD_WEIGHT_MAP[cat][por]}g</span>
                                  {qty > 0 && <div className={`absolute -top-2 -right-2 w-8 h-8 ${config.badge} text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white animate-in zoom-in`}>{qty}</div>}
                                </button>
                                {qty > 0 && <button onClick={(e) => { e.stopPropagation(); updateFoodQuantity(cat, por, -1); }} className="absolute -bottom-2 -left-2 w-7 h-7 bg-white border-2 border-slate-100 text-slate-400 rounded-full flex items-center justify-center shadow-sm"><Minus size={14} /></button>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="fixed bottom-8 left-0 right-0 px-8 flex justify-center z-20">
                <button disabled={!weightBefore || actionLoading} onClick={saveEntry} className="w-full max-w-sm py-6 bg-red-600 disabled:bg-slate-200 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] border-b-4 border-red-800 transition-all text-lg italic flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="animate-spin" /> : 'Finalizar Registro'}
                </button>
              </div>
            </main>
          )}

          {view === 'ADD_HAWK' && (
            <main className="p-8 space-y-8 flex-1 flex flex-col bg-white">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Nuevo <span className="text-red-600">Halcón</span></h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Nombre</label>
                  <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: Ártico" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Especie</label>
                  <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none uppercase">
                    {SPECIES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Peso de Vuelo Ideal (g)</label>
                  <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Ej: 850" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-xl outline-none text-red-600" />
                </div>
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