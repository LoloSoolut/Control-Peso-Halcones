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
import { supabase, IS_MOCK_MODE } from './services/supabase';
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
  const [dataError, setDataError] = useState<string | null>(null);
  
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
          await loadData(session.user.id);
        }
      } catch (err) {
        console.error("Error inicializando sesión:", err);
      } finally {
        setIsInitialLoading(false);
        // Garantizar que el splash screen desaparezca siempre
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('app-ready'));
        }, 100);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        loadData(session.user.id);
      } else {
        setUser(null);
        setView('AUTH');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
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
          totalFoodWeight: (e.weight_after || e.weightAfter || 0) - (e.weight_before || e.weightBefore || 0),
          date: e.date || e.created_at
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      setHawks(formattedHawks);
    } catch (e: any) {
      setDataError("Sincronización pausada.");
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
        setView('DASHBOARD');
      } else if (action === 'SIGNUP') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("¡Cuenta creada! Revisa tu email para confirmar.");
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
      setHawkName(''); 
      setHawkTargetWeight(''); 
      setView('DASHBOARD');
    } catch(e: any) {
        alert(e.message);
    } finally { setActionLoading(false); }
  };

  if (isInitialLoading) return null;

  // --- RENDERIZADO DE AUTENTICACIÓN ---
  if (!user) {
    return (
      <div className="flex-1 flex flex-col p-10 justify-center items-center text-center max-w-md mx-auto w-full bg-slate-950 md:rounded-[3rem] md:my-10 border border-slate-800 shadow-2xl font-inter animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-red-900/40 rotate-3">
          <Bird className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black mb-1 uppercase italic tracking-tighter text-white">FALCON<span className="text-red-600">PRO</span></h1>
        <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.5em] mb-12 italic">Precision Weight Management</p>
        
        <div className="w-full space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-600 transition-colors" size={18} />
            <input 
              type="email" 
              placeholder="EMAIL DE CETRERO" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full pl-12 pr-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-white font-bold text-xs uppercase focus:border-red-600 transition-all outline-none" 
            />
          </div>

          <div className="relative group">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-600 transition-colors" size={18} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="CONTRASEÑA" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full pl-12 pr-14 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-white font-bold text-xs uppercase focus:border-red-600 transition-all outline-none" 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-2 z-10"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {authError && <p className="text-red-500 text-[10px] font-bold uppercase py-2 animate-pulse">{authError}</p>}

          <button 
            disabled={actionLoading} 
            onClick={() => handleAuth(view === 'SIGNUP' ? 'SIGNUP' : 'LOGIN')} 
            className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest hover:bg-red-500 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
             {actionLoading ? <Loader2 className="animate-spin" /> : (view === 'SIGNUP' ? 'Crear Perfil' : 'Entrar al Sistema')}
          </button>

          <div className="pt-4 flex flex-col gap-4">
            <button 
              onClick={() => setView(view === 'AUTH' ? 'SIGNUP' : 'AUTH')} 
              className="text-slate-500 text-[10px] font-black uppercase hover:text-white transition-colors"
            >
              {view === 'AUTH' ? '¿No tienes cuenta? Regístrate' : '¿Ya eres usuario? Inicia sesión'}
            </button>
            <button 
              onClick={() => handleAuth('GUEST')} 
              className="w-full py-4 text-slate-600 font-black uppercase text-[9px] tracking-widest hover:text-slate-400 transition-colors"
            >
              Modo Invitado (Solo Local)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- LOGICA DE VISTA SEGURA ---
  // Si estamos logueados pero la vista es de login/registro, forzamos dashboard
  const currentView = (view === 'AUTH' || view === 'SIGNUP') ? 'DASHBOARD' : view;

  return (
    <div className="flex-1 flex flex-col w-full max-w-6xl mx-auto bg-white overflow-hidden md:rounded-[2.5rem] relative md:shadow-2xl md:my-6 border border-slate-100 font-inter animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {currentView === 'DASHBOARD' && (
          <>
            <header className="px-8 py-10 flex justify-between items-center border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-xl z-20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-red-600 shadow-xl"><Bird size={24} /></div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900">MI <span className="text-red-600">EQUIPO</span></h2>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{hawks.length} AVES ACTIVAS</p>
                </div>
              </div>
              <button onClick={() => setView('ADD_HAWK')} className="w-14 h-14 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 hover:scale-105 transition-transform"><Plus size={28}/></button>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hawks.map(h => {
                  const lastEntry = h.entries[0];
                  const diff = lastEntry ? lastEntry.weightBefore - h.targetWeight : 0;
                  return (
                    <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="group p-8 bg-white border border-slate-100 rounded-[2.5rem] cursor-pointer hover:border-red-600 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6">
                         <div className={`text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${Math.abs(diff) < 10 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                           {Math.abs(diff) < 10 ? 'EN PESO' : (diff > 0 ? 'ALTO' : 'TEMPLADO')}
                         </div>
                      </div>
                      <div className="flex flex-col gap-6">
                        <div>
                          <h3 className="text-2xl font-black text-slate-900 group-hover:text-red-600 transition-colors">{h.name}</h3>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{h.species}</p>
                        </div>
                        <div className="flex justify-between items-end pt-4 border-t border-slate-50">
                          <div>
                             <p className="text-[8px] font-black text-slate-300 uppercase mb-1">TARGET</p>
                             <p className="text-xl font-black text-slate-400">{h.targetWeight}g</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[8px] font-black text-slate-300 uppercase mb-1">ACTUAL</p>
                             <p className="text-4xl font-black text-slate-900 leading-none">{lastEntry?.weightBefore || '--'}<span className="text-xs ml-1 font-bold text-slate-300">g</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {hawks.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center opacity-20"><Bird size={80} className="mb-4" /><p className="font-black uppercase tracking-widest text-xs">Añade tu primer halcón</p></div>
              )}
              <div className="flex justify-center pt-10">
                 <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase hover:text-red-600 transition-colors"><LogOut size={14} /> Desconectar Sistema</button>
              </div>
            </main>
          </>
        )}

        {currentView === 'HAWK_DETAILS' && (
          selectedHawk ? (
            <>
              <header className="px-8 py-10 flex justify-between items-center border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-xl z-30">
                <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all"><ChevronLeft size={24}/></button>
                <div className="text-center">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">{selectedHawk.name}</h2>
                  <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">{selectedHawk.species}</p>
                </div>
                <button onClick={async () => { if(confirm('¿Eliminar ave?')) { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); }}} className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={20}/></button>
              </header>

              <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar pb-32">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-slate-950 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-10">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">PESO ÚLTIMO REGISTRO</p>
                        <p className="text-8xl font-black italic leading-none">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-2xl not-italic ml-2 text-red-600">g</span></p>
                        <div className="mt-8 flex items-center gap-4">
                          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                            <Target size={14} className="text-red-500" />
                            <span className="text-[10px] font-black uppercase text-slate-400">TARGET: {selectedHawk.targetWeight}g</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-32 md:w-48 bg-white/5 rounded-2xl border border-white/10 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <Area type="monotone" dataKey="weight" stroke="#dc2626" strokeWidth={3} fill="#dc2626" fillOpacity={0.1} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-[3rem] p-8 flex flex-col justify-between shadow-xl">
                    <div className="space-y-4">
                       <div className="p-5 bg-slate-50 rounded-2xl">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">VARIACIÓN DÍA ANTERIOR</p>
                          <p className="text-3xl font-black text-slate-900">
                            {selectedHawk.entries.length > 1 ? (selectedHawk.entries[0].weightBefore - selectedHawk.entries[1].weightBefore).toFixed(1) : '--'}
                            <span className="text-sm ml-1 text-slate-300">g</span>
                          </p>
                       </div>
                       <div className="p-5 bg-red-50 rounded-2xl">
                          <p className="text-[9px] font-black text-red-600 uppercase mb-1 text-center">ÚLTIMA GORGA</p>
                          <p className="text-3xl font-black text-red-600 text-center">+{selectedHawk.entries[0]?.totalFoodWeight.toFixed(1) || 0}<span className="text-sm ml-1">g</span></p>
                       </div>
                    </div>
                    <button onClick={() => setView('ADD_ENTRY')} className="mt-6 w-full py-5 bg-red-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all">REGISTRAR PESO</button>
                  </div>
                </div>

                <div className="space-y-6">
                   <div className="flex items-center gap-4 px-4">
                      <TrendingUp size={16} className="text-slate-300" />
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">HISTORIAL DE VUELO</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedHawk.entries.map(e => (
                        <div key={e.id} className="p-6 bg-white border border-slate-50 rounded-[2.5rem] flex justify-between items-center group hover:border-red-600 transition-all">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all"><Scale size={18}/></div>
                              <div>
                                <p className="text-xl font-black text-slate-900 leading-none">{e.weightBefore}<span className="text-xs text-slate-300 ml-1">g</span></p>
                                <p className="text-[8px] font-bold text-red-600 uppercase mt-1">GORGA: +{e.totalFoodWeight.toFixed(1)}g</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase">{new Date(e.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                              <p className="text-[8px] font-bold text-slate-200 uppercase">{new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </main>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-400">
               <Bird size={48} className="mb-4 opacity-20" />
               <p className="font-bold uppercase text-xs tracking-widest">Halcón no encontrado</p>
               <button onClick={() => setView('DASHBOARD')} className="mt-4 text-red-600 font-black uppercase text-[10px] tracking-widest">Volver al Dashboard</button>
            </div>
          )
        )}

        {currentView === 'ADD_ENTRY' && (
          <main className="flex-1 flex flex-col p-8 md:p-12 space-y-12 overflow-y-auto no-scrollbar pb-36 animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center">
              <button onClick={() => setView('HAWK_DETAILS')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft size={24}/></button>
              <div className="text-center">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">CONTROL <span className="text-red-600">DIARIO</span></h2>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <div className="w-12"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
               <div className="flex flex-col items-center justify-center space-y-10">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-4">PESO EN BÁSCULA (g)</p>
                    <input 
                      value={weightBefore} 
                      onChange={e => setWeightBefore(e.target.value)} 
                      type="number" 
                      placeholder="000.0" 
                      className="w-full text-center text-9xl font-black outline-none text-slate-900 bg-transparent placeholder:text-slate-100 caret-red-600 tabular-nums italic" 
                      autoFocus 
                    />
                  </div>
                  <div className="flex items-center gap-6 p-6 bg-slate-950 rounded-[2.5rem] w-full max-w-sm text-white shadow-2xl border-b-8 border-slate-900">
                     <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg"><Utensils size={32} /></div>
                     <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GORGA CALCULADA</p>
                        <p className="text-5xl font-black tabular-nums">{totalFoodWeight}<span className="text-xl ml-2 text-slate-600">g</span></p>
                     </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] ml-6">TABLA DE ALIMENTACIÓN</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                       <div key={cat} className={`${FOOD_COLORS[cat].bg} p-6 rounded-[2.5rem] border border-transparent hover:border-slate-200 transition-all space-y-4`}>
                         <p className={`text-[9px] font-black uppercase tracking-widest ${FOOD_COLORS[cat].text}`}>{cat}</p>
                         <div className="grid grid-cols-2 gap-2">
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
                                }} className="group bg-white p-3 rounded-2xl border border-slate-100 relative flex flex-col items-center active:scale-90 transition-all shadow-sm">
                                  <span className="text-[7px] font-black uppercase text-slate-300 group-hover:text-red-600 mb-1">{por}</span>
                                  <span className="font-black text-md text-slate-900">{FOOD_WEIGHT_MAP[cat][por]}g</span>
                                  {qty > 0 && <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 text-white rounded-full text-[9px] flex items-center justify-center font-black border-4 border-white animate-in zoom-in">{qty}</div>}
                                </button>
                              );
                           })}
                         </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="fixed bottom-10 left-0 right-0 px-8 flex justify-center z-50">
              <button 
                disabled={!weightBefore || actionLoading} 
                onClick={saveEntry} 
                className="group w-full max-w-sm py-6 bg-slate-950 disabled:bg-slate-200 text-white font-black rounded-[2.5rem] shadow-2xl uppercase tracking-[0.3em] active:scale-95 hover:bg-red-600 transition-all flex items-center justify-center gap-4"
              >
                {actionLoading ? <Loader2 className="animate-spin" /> : <><Check size={28}/> GUARDAR REGISTRO</>}
              </button>
            </div>
          </main>
        )}

        {currentView === 'ADD_HAWK' && (
          <main className="p-8 md:p-14 space-y-12 flex-1 flex flex-col items-center animate-in slide-in-from-right-20">
            <div className="w-full flex items-center gap-6">
              <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all"><ChevronLeft size={24}/></button>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">ALTA DE <span className="text-red-600">HALCÓN</span></h2>
            </div>
            
            <div className="w-full max-w-2xl bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-6">NOMBRE DEL AVE</label>
                <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: RAYO NEGRO" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-2xl outline-none focus:border-red-600 transition-all uppercase" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-6">ESPECIE / HÍBRIDO</label>
                <div className="relative">
                  <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-2xl outline-none uppercase appearance-none focus:border-red-600 transition-all">
                    {SPECIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 text-red-600 pointer-events-none" size={24} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-6">PESO IDEAL (g)</label>
                <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="000" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-black text-5xl outline-none focus:border-red-600 transition-all text-center tabular-nums" />
              </div>
              <button disabled={actionLoading} onClick={addHawk} className="w-full py-6 bg-red-600 text-white font-black rounded-3xl uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all">
                {actionLoading ? <Loader2 className="animate-spin mx-auto" /> : 'CONECTAR HALCÓN'}
              </button>
            </div>
          </main>
        )}

      </div>
    </div>
  );
};

export default App;