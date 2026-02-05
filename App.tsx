import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Eye, EyeOff, Utensils, Calendar, Target,
  ChevronRight, Info, Activity, Minus, Check, X, Mail, ShieldCheck, Loader2, AlertCircle, WifiOff, UserCircle
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase, IS_MOCK_MODE } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, Tooltip
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
        targetWeight: h.target_weight || h.targetWeight,
        entries: (h.entries || []).map((e: any) => ({
          ...e,
          weightBefore: e.weight_before || e.weightBefore,
          totalFoodWeight: e.total_food_weight || e.totalFoodWeight,
          foodSelections: e.food_selections || e.foodSelections || []
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
        window.location.reload(); // Recarga para activar MockSupabase
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
      setAuthError(errorMsg.includes('rate limit') ? "Demasiados intentos. Usa el 'Modo Invitado' para probar la app ahora." : errorMsg);
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
        date: new Date().toISOString() 
      }]);
      if (error) throw error;
      await loadData(user.id);
      setWeightBefore(''); setCurrentFoodSelections([]); setView('HAWK_DETAILS');
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

  // Auth Screen Render
  if (!user && (view === 'AUTH' || view === 'SIGNUP' || view === 'RECOVER')) {
    return (
      <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-sm mx-auto w-full font-inter animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-red-600 rounded-[1.8rem] flex items-center justify-center mb-6 shadow-2xl">
          <Bird className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black mb-1 uppercase italic tracking-tighter">FALCON <span className="text-red-600">PRO</span></h1>
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.5em] mb-10">REGISTRO DIARIO DE PESO</p>
        
        <div className="w-full space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold uppercase text-xs" />
          </div>
          
          {view !== 'RECOVER' && (
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type={showPassword ? "text" : "password"} placeholder="CONTRASEÑA" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-bold uppercase text-xs" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {authError && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[11px] font-bold uppercase flex items-center gap-2 text-left leading-tight border border-red-100">
              <AlertCircle className="shrink-0" size={16} /> {authError}
            </div>
          )}
          
          {authSuccessMsg && (
            <div className="p-4 bg-green-50 text-green-700 rounded-2xl text-[11px] font-bold uppercase flex items-center gap-2 text-left leading-tight">
              <Check className="shrink-0" size={16} /> {authSuccessMsg}
            </div>
          )}

          <button 
            disabled={actionLoading} 
            onClick={() => handleAuth(view === 'SIGNUP' ? 'SIGNUP' : (view === 'RECOVER' ? 'RECOVER' : 'LOGIN'))} 
            className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl border-b-4 border-red-800 flex items-center justify-center gap-2 uppercase tracking-widest active:translate-y-1 transition-all"
          >
            {actionLoading ? <Loader2 className="animate-spin" /> : (view === 'SIGNUP' ? 'Crear Cuenta' : (view === 'RECOVER' ? 'Recuperar' : 'Entrar'))}
          </button>
          
          <div className="relative py-4">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
             <div className="relative flex justify-center text-[8px] font-black uppercase tracking-widest"><span className="bg-white px-2 text-slate-300">O TAMBIÉN</span></div>
          </div>

          <button 
            onClick={() => handleAuth('GUEST')} 
            className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest active:scale-95 transition-all"
          >
            <UserCircle size={18} className="text-red-500" /> Probar sin cuenta (Local)
          </button>
          
          <div className="pt-4 flex flex-col gap-3">
            {view === 'AUTH' ? (
              <>
                <button onClick={() => setView('SIGNUP')} className="text-slate-400 text-[10px] font-black uppercase">¿No tienes cuenta? <span className="text-slate-900 underline">Regístrate</span></button>
                <button onClick={() => setView('RECOVER')} className="text-slate-400 text-[9px] font-black uppercase opacity-60 italic">¿Olvidaste tu contraseña?</button>
              </>
            ) : (
              <button onClick={() => setView('AUTH')} className="text-slate-400 text-[10px] font-black uppercase">Ya tengo cuenta. <span className="text-slate-900 underline">Volver</span></button>
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
          {IS_MOCK_MODE && <div className="bg-slate-900 text-red-500 text-[8px] p-1 text-center font-black uppercase tracking-widest">MODO INVITADO (DATOS LOCALES)</div>}
          {dataError && <div className="bg-amber-500 text-white text-[9px] p-2 text-center font-black uppercase flex items-center justify-center gap-2"><WifiOff size={12}/> {dataError}</div>}
          
          {view === 'DASHBOARD' && (
            <>
              <header className="p-8 flex justify-between items-center border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-lg z-10">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase">MIS <span className="text-red-600">HALCONES</span></h2>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{hawks.length} AVES REGISTRADAS</p>
                </div>
                <button onClick={() => setView('ADD_HAWK')} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl border-b-4 border-red-800 active:scale-95 transition-all"><Plus size={32}/></button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {hawks.map(h => (
                  <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="p-6 bg-slate-50 border-2 border-transparent hover:border-red-600 rounded-[2.5rem] flex items-center justify-between cursor-pointer active:scale-95 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm group-hover:bg-red-600 group-hover:text-white transition-colors"><Bird size={28}/></div>
                      <div><h3 className="font-black text-xl">{h.name}</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{h.species}</p></div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Último Peso</p>
                      <p className="font-black text-2xl text-slate-900 leading-none">{h.entries[0]?.weightBefore || '--'}<span className="text-xs ml-1">g</span></p>
                    </div>
                  </div>
                ))}
                
                {hawks.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-200">
                    <Bird size={64} className="opacity-20 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No hay halcones registrados</p>
                  </div>
                )}

                <div className="pt-10 flex flex-col items-center gap-4">
                  <button onClick={() => supabase.auth.signOut()} className="px-8 py-3 bg-slate-100 text-slate-400 hover:text-red-600 rounded-full text-[10px] font-black uppercase flex items-center gap-2 transition-all"><LogOut size={14}/> {IS_MOCK_MODE ? 'Salir de Invitado' : 'Cerrar Sesión'}</button>
                  <p className="text-[8px] font-bold text-slate-300 uppercase italic">Falcon Weight Pro v1.3</p>
                </div>
              </main>
            </>
          )}

          {view === 'HAWK_DETAILS' && selectedHawk && (
            <>
              <header className="p-8 flex justify-between items-center border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-lg z-10">
                <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
                <h2 className="font-black text-2xl italic uppercase tracking-tighter">{selectedHawk.name}</h2>
                <button onClick={async () => { if(confirm('¿Seguro que quieres borrar este halcón?')) { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); }}} className="w-12 h-12 text-slate-200 hover:text-red-600 flex items-center justify-center transition-colors"><Trash2 size={20}/></button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-red-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-red-600/20">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Peso Actual</p>
                     <p className="text-5xl font-black leading-none">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-sm font-bold ml-1">g</span></p>
                   </div>
                   <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Ideal Vuelo</p>
                     <p className="text-5xl font-black leading-none">{selectedHawk.targetWeight}<span className="text-sm font-bold ml-1">g</span></p>
                   </div>
                </div>
                
                {selectedHawk.entries.length > 0 ? (
                  <div className="bg-white border-2 border-slate-50 p-6 rounded-[2.5rem]">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Evolución Semanal</p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <XAxis dataKey="date" hide />
                          <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', fontWeight: 'bold' }} />
                          <Area type="monotone" dataKey="weight" stroke="#dc2626" strokeWidth={4} fill="#dc2626" fillOpacity={0.1} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-10 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-300">
                    <Activity className="mb-2 opacity-20" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Sin historial de peso</p>
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Registros Recientes</p>
                  {selectedHawk.entries.slice(0, 5).map(e => (
                    <div key={e.id} className="p-6 bg-white border-2 border-slate-50 rounded-[2rem] flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-black">{e.weightBefore}g</p>
                        <p className="text-[10px] font-bold text-red-600 uppercase">+{e.totalFoodWeight}g comida</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase">{new Date(e.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </main>
              <div className="fixed bottom-10 left-0 right-0 px-8 flex justify-center z-10">
                <button onClick={() => setView('ADD_ENTRY')} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-2xl uppercase tracking-widest border-b-4 border-red-800 active:translate-y-1 transition-all">
                  Registrar Peso Diario
                </button>
              </div>
            </>
          )}

          {view === 'ADD_ENTRY' && (
            <main className="p-8 space-y-8 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-32">
              <div className="flex justify-between items-center">
                <button onClick={() => setView('HAWK_DETAILS')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
                <h2 className="font-black text-xl italic uppercase tracking-tighter">REGISTRO <span className="text-red-600">HOY</span></h2>
                <div className="w-12"></div>
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Peso antes de comer (g)</p>
                <input 
                  value={weightBefore} 
                  onChange={e => setWeightBefore(e.target.value)} 
                  type="number" 
                  placeholder="000" 
                  className="w-full text-center text-9xl font-black outline-none tabular-nums text-slate-900 placeholder:text-slate-100" 
                  autoFocus
                />
              </div>
              
              <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] flex justify-between items-center border-b-4 border-slate-800">
                <div className="flex items-center gap-2">
                  <Utensils size={18} className="text-red-500" />
                  <span className="font-black uppercase text-[10px] tracking-widest">Total Comida</span>
                </div>
                <span className="text-4xl font-black text-red-500">{totalFoodWeight}<span className="text-sm ml-1">g</span></span>
              </div>

              <div className="space-y-6">
                {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                  <div key={cat} className={`${FOOD_COLORS[cat].bg} p-6 rounded-[2.5rem] border-2 ${FOOD_COLORS[cat].border} space-y-4`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${FOOD_COLORS[cat].text}`}>{cat}</p>
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
                           }} className="bg-white p-4 rounded-2xl border border-slate-100 relative flex flex-col items-center active:scale-95 transition-all shadow-sm">
                             <span className="text-[8px] font-black uppercase opacity-40 mb-1">{por}</span>
                             <span className="font-black text-lg">{FOOD_WEIGHT_MAP[cat][por]}g</span>
                             {qty > 0 && <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center font-black border-2 border-white">{qty}</div>}
                           </button>
                         );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="fixed bottom-8 left-0 right-0 px-8 flex justify-center z-10">
                <button 
                  disabled={!weightBefore || actionLoading} 
                  onClick={saveEntry} 
                  className="w-full max-w-sm py-6 bg-red-600 disabled:bg-slate-200 text-white font-black rounded-[2rem] shadow-2xl uppercase border-b-4 border-red-800 flex items-center justify-center gap-2 active:translate-y-1 transition-all"
                >
                  {actionLoading ? <Loader2 className="animate-spin" /> : 'Finalizar Registro'}
                </button>
              </div>
            </main>
          )}

          {view === 'ADD_HAWK' && (
            <main className="p-8 space-y-8 flex-1 flex flex-col animate-in slide-in-from-right-10 duration-500">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('DASHBOARD')} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><ChevronLeft/></button>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">NUEVO <span className="text-red-600">HALCÓN</span></h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Nombre</label>
                  <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Ej: Ártico" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl outline-none focus:border-red-600 transition-colors" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Especie</label>
                  <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl outline-none uppercase appearance-none focus:border-red-600 transition-colors">
                    {SPECIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">Peso de Vuelo (g)</label>
                  <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Ej: 850" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl outline-none focus:border-red-600 transition-colors" />
                </div>
              </div>
              
              <button disabled={actionLoading} onClick={addHawk} className="w-full py-6 bg-red-600 text-white font-black rounded-[2rem] mt-auto uppercase border-b-4 border-red-800 active:translate-y-1 transition-all">
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