import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  Target, Activity, Minus, Check, X, Mail, ShieldCheck, 
  Loader2, AlertCircle, WifiOff, UserCircle, Scale, MessageSquare, ChevronDown, 
  ArrowUpRight, ArrowDownRight, Zap, History, LayoutDashboard, Settings,
  Utensils, TrendingUp, Clock, Eye, EyeOff, Edit3, Egg, Gauge
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry, FoodSelection, FoodCategory, FoodPortion, FOOD_WEIGHT_MAP 
} from './types';
import { supabase } from './services/supabase';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';

const SPECIES_OPTIONS = ['Peregrine', 'Hybrid', 'Gyrfalcon', 'Lanner', 'Saker', 'Harris', 'Goshawk', 'Kestrel'];

const FOOD_COLORS: Record<FoodCategory, { bg: string, border: string, text: string, accent: string }> = {
  'Chick': { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-900', accent: 'bg-yellow-600' },
  'Pigeon': { bg: 'bg-slate-200', border: 'border-slate-300', text: 'text-slate-900', accent: 'bg-slate-600' },
  'Quail': { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900', accent: 'bg-orange-600' },
  'Partridge': { bg: 'bg-stone-200', border: 'border-stone-400', text: 'text-stone-900', accent: 'bg-stone-600' },
  'Duck': { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-900', accent: 'bg-emerald-600' }
};

const FOOD_ICONS: Record<FoodCategory, React.ElementType> = {
  'Chick': Egg,
  'Pigeon': Bird,
  'Quail': Target,
  'Partridge': Zap,
  'Duck': Activity
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
    if (!selectedHawk) return [];
    return [...selectedHawk.entries]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(e => ({
        date: new Date(e.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        weight: e.weightBefore,
        fullDate: new Date(e.date).toLocaleDateString()
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
        console.error("Session initialization error:", err);
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
        .select('*, entries(*, food_items(*))')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const formattedHawks = (data || []).map((h: any) => ({
        ...h,
        targetWeight: h.target_weight || h.targetWeight,
        entries: (h.entries || []).map((e: any) => ({
          ...e,
          weightBefore: e.weight_before || e.weightBefore,
          totalFoodWeight: (e.weight_after || e.weightAfter || 0) - (e.weight_before || e.weightBefore || 0),
          foodSelections: (e.food_items || []).map((item: any) => ({
            id: item.id,
            category: item.type,
            portion: item.portion,
            quantity: item.quantity
          })),
          date: e.date || e.created_at
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
      setHawks(formattedHawks);
    } catch (e: any) {
      console.error("Error loading data:", e);
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
        alert("Account created! Please check your email for verification.");
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

  const updateFoodQuantity = (category: FoodCategory, portion: FoodPortion, delta: number) => {
    setCurrentFoodSelections(prev => {
      const index = prev.findIndex(f => f.category === category && f.portion === portion);
      if (index > -1) {
        const updated = [...prev];
        const newQty = updated[index].quantity + delta;
        if (newQty <= 0) {
          return updated.filter((_, i) => i !== index);
        }
        updated[index].quantity = newQty;
        return updated;
      } else if (delta > 0) {
        return [...prev, { id: Math.random().toString(), category, portion, quantity: 1 }];
      }
      return prev;
    });
  };

  const saveEntry = async () => {
    if (!selectedHawkId || !weightBefore || !user) return;
    setActionLoading(true);
    try {
      const wBeforeNum = parseFloat(weightBefore);
      const wAfterNum = wBeforeNum + totalFoodWeight;
      
      const { data: entryData, error: entryError } = await supabase.from('entries').insert([{ 
        hawk_id: selectedHawkId, 
        weight_before: wBeforeNum, 
        weight_after: wAfterNum, 
        date: new Date().toISOString() 
      }]).select().single();
      
      if (entryError) throw entryError;

      if (currentFoodSelections.length > 0) {
        const itemsToInsert = currentFoodSelections.map(f => ({
          entry_id: entryData.id,
          type: f.category,
          portion: f.portion,
          quantity: f.quantity
        }));
        await supabase.from('food_items').insert(itemsToInsert);
      }

      await loadData(user.id);
      setWeightBefore(''); 
      setCurrentFoodSelections([]); 
      setView('HAWK_DETAILS');
    } catch(e: any) {
        alert("Save error: " + e.message);
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

  const updateHawk = async () => {
    if (!selectedHawkId || !hawkName || !hawkTargetWeight || !user) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('hawks')
        .update({ 
          name: hawkName.toUpperCase(), 
          species: hawkSpecies, 
          target_weight: parseFloat(hawkTargetWeight) 
        })
        .eq('id', selectedHawkId);

      if (error) throw error;
      await loadData(user.id);
      setView('HAWK_DETAILS');
    } catch(e: any) {
        alert("Update error: " + e.message);
    } finally { setActionLoading(false); }
  };

  const startEditHawk = () => {
    if (!selectedHawk) return;
    setHawkName(selectedHawk.name);
    setHawkSpecies(selectedHawk.species);
    setHawkTargetWeight(selectedHawk.targetWeight.toString());
    setView('EDIT_HAWK');
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-md mx-auto w-full bg-slate-950 min-h-screen font-inter animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl rotate-3">
          <Bird className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black mb-1 uppercase italic tracking-tighter text-white">FALCON<span className="text-red-600">WEIGH</span></h1>
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
              placeholder="PASSWORD" 
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
             {actionLoading ? <Loader2 className="animate-spin" size={18} /> : (view === 'SIGNUP' ? 'Create Profile' : 'Login')}
          </button>

          <button 
            onClick={() => setView(view === 'AUTH' ? 'SIGNUP' : 'AUTH')} 
            className="w-full pt-4 text-slate-500 text-[9px] font-black uppercase hover:text-white"
          >
            {view === 'AUTH' ? "Don't have an account? Sign up" : "Already a user? Login"}
          </button>
          
          <button 
            onClick={() => handleAuth('GUEST')} 
            className="w-full py-3 text-slate-700 font-black uppercase text-[8px] tracking-widest hover:text-slate-500"
          >
            Guest Mode (Offline)
          </button>
        </div>
      </div>
    );
  }

  const currentView = (view === 'AUTH' || view === 'SIGNUP') ? 'DASHBOARD' : view;

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-slate-50 min-h-screen font-inter animate-in fade-in duration-500 pb-10">
      
      {currentView === 'DASHBOARD' && (
        <div className="flex-1 flex flex-col h-screen">
          <header className="px-6 py-8 flex justify-between items-center border-b border-slate-200 bg-white sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-red-600 shadow-lg"><Bird size={20} /></div>
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-slate-900">MY <span className="text-red-600">TEAM</span></h2>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{hawks.length} BIRDS</p>
              </div>
            </div>
            <button onClick={() => { setHawkName(''); setHawkSpecies(SPECIES_OPTIONS[0]); setHawkTargetWeight(''); setView('ADD_HAWK'); }} className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"><Plus size={24}/></button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-4">
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
                        {Math.abs(diff) < 10 ? 'TARGET' : (diff > 0 ? 'HIGH' : 'LOW')}
                      </div>
                    </div>
                    <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                      <div>
                         <p className="text-[7px] font-black text-slate-300 uppercase">TARGET</p>
                         <p className="text-sm font-black text-slate-400">{h.targetWeight}g</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[7px] font-black text-slate-300 uppercase">CURRENT</p>
                         <p className="text-2xl font-black text-slate-900">{lastEntry?.weightBefore || '--'}<span className="text-xs ml-1 font-bold text-slate-300">g</span></p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hawks.length === 0 && (
              <div className="py-20 text-center opacity-20"><Bird size={60} className="mx-auto mb-2" /><p className="font-bold text-xs uppercase tracking-widest">Add your first falcon</p></div>
            )}
            <div className="flex justify-center pt-8 pb-8">
               <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase hover:text-red-600"><LogOut size={12} /> Sign Out</button>
            </div>
          </main>
        </div>
      )}

      {currentView === 'HAWK_DETAILS' && selectedHawk && (
        <div className="flex-1 flex flex-col h-screen">
          <header className="px-6 py-8 flex justify-between items-center bg-white border-b border-slate-200 sticky top-0 z-30">
            <button onClick={() => setView('DASHBOARD')} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 active:bg-slate-900 active:text-white"><ChevronLeft size={20}/></button>
            <div className="text-center">
              <h2 className="text-xl font-black italic uppercase tracking-tighter text-slate-900">{selectedHawk.name}</h2>
              <p className="text-[8px] font-black text-red-600 uppercase">{selectedHawk.species}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={startEditHawk} className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center active:bg-slate-900 active:text-white"><Edit3 size={18}/></button>
              <button onClick={async () => { if(confirm('Delete falcon?')) { await supabase.from('hawks').delete().eq('id', selectedHawk.id); await loadData(user.id); setView('DASHBOARD'); }}} className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center active:bg-rose-500 active:text-white"><Trash2 size={18}/></button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">WEIGHT EVOLUTION</p>
                <div className="h-48 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} 
                        dy={10}
                      />
                      <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
                      <Tooltip 
                        contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold'}}
                        itemStyle={{color: '#dc2626'}}
                      />
                      <ReferenceLine y={selectedHawk.targetWeight} stroke="#dc2626" strokeDasharray="5 5" strokeOpacity={0.5} />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#dc2626" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorWeight)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-800">
                  <p className="text-4xl font-black italic">{selectedHawk.entries[0]?.weightBefore || '--'}<span className="text-xl not-italic ml-2 text-red-600">g</span></p>
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">TARGET WEIGHT</p>
                    <p className="text-lg font-black text-white/40">{selectedHawk.targetWeight}g</p>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setView('ADD_ENTRY')} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
              <Scale size={18} /> LOG TODAY'S WEIGHT
            </button>

            <div className="space-y-3 pb-24">
               <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                 <History size={12} /> RECENT LOGS
               </h3>
               {selectedHawk.entries.map(e => (
                 <div key={e.id} className="p-4 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-red-600 shadow-md">
                           <Scale size={18} strokeWidth={2.5} />
                         </div>
                         <div>
                           <p className="text-xl font-black text-slate-900">{e.weightBefore}<span className="text-xs text-slate-300 ml-1">g</span></p>
                           <p className="text-[8px] font-black text-slate-400 uppercase">{new Date(e.date).toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'short' })}</p>
                         </div>
                       </div>
                       <div className="text-right">
                          <div className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                            <p className="text-[8px] font-black text-emerald-600 uppercase">FOOD TOTAL</p>
                            <p className="text-xs font-black text-emerald-700">+{e.totalFoodWeight.toFixed(0)}g</p>
                          </div>
                       </div>
                    </div>

                    {e.foodSelections && e.foodSelections.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {e.foodSelections.map((fs, idx) => {
                          const Icon = FOOD_ICONS[fs.category];
                          const colors = FOOD_COLORS[fs.category];
                          return (
                            <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ${colors.bg} border ${colors.border} shadow-sm`}>
                              <Icon className={colors.text} size={10} />
                              <span className={`text-[9px] font-black uppercase ${colors.text}`}>{fs.portion}</span>
                              <span className={`text-[9px] font-black px-1.5 rounded-full ${colors.accent} text-white`}>x{fs.quantity}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                 </div>
               ))}
               {selectedHawk.entries.length === 0 && (
                 <div className="py-12 text-center opacity-30 flex flex-col items-center">
                    <Gauge size={40} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No previous records found</p>
                 </div>
               )}
            </div>
          </main>
        </div>
      )}

      {currentView === 'ADD_ENTRY' && (
        <div className="flex-1 flex flex-col h-screen">
          <main className="flex-1 overflow-y-auto p-6 space-y-8 animate-in slide-in-from-bottom-10 pb-32">
            <div className="flex justify-between items-center">
              <button onClick={() => setView('HAWK_DETAILS')} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400"><ChevronLeft size={20}/></button>
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">NEW <span className="text-red-600">LOG</span></h2>
              <div className="w-10"></div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SCALE WEIGHT (g)</p>
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
                    <p className="text-[7px] font-black text-slate-500 uppercase">TOTAL FEEDING</p>
                    <p className="text-2xl font-black">{totalFoodWeight}<span className="text-sm ml-1 text-slate-500">g</span></p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2">DAILY FEEDING</p>
               <div className="grid grid-cols-1 gap-3">
                  {(Object.keys(FOOD_WEIGHT_MAP) as FoodCategory[]).map(cat => (
                    <div key={cat} className={`${FOOD_COLORS[cat].bg} p-4 rounded-3xl border ${FOOD_COLORS[cat].border} shadow-sm space-y-3`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${FOOD_COLORS[cat].text} flex items-center gap-2`}>
                        <div className={`w-2 h-2 rounded-full ${FOOD_COLORS[cat].accent}`}></div>
                        {cat === 'Chick' ? 'Chicks' : cat === 'Pigeon' ? 'Pigeons' : cat === 'Quail' ? 'Quail' : cat === 'Partridge' ? 'Partridge' : 'Duck'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(Object.keys(FOOD_WEIGHT_MAP[cat]) as FoodPortion[]).map(por => {
                           const sel = currentFoodSelections.find(f => f.category === cat && f.portion === por);
                           const qty = sel?.quantity || 0;
                           return (
                             <div key={por} className="relative group">
                               <div className={`flex items-center bg-white/60 border border-white rounded-2xl overflow-hidden transition-all ${qty > 0 ? 'ring-2 ring-slate-900/10 shadow-md' : ''}`}>
                                 <button 
                                   onClick={() => updateFoodQuantity(cat, por, -1)}
                                   disabled={qty === 0}
                                   className={`w-10 h-12 flex items-center justify-center transition-colors ${qty > 0 ? 'text-red-600 hover:bg-red-50' : 'text-slate-200 cursor-not-allowed'}`}
                                 >
                                   <Minus size={16} strokeWidth={3} />
                                 </button>
                                 
                                 <div 
                                   className="flex-1 text-center py-2 cursor-pointer active:opacity-50"
                                   onClick={() => updateFoodQuantity(cat, por, 1)}
                                 >
                                   <p className={`text-[9px] font-black uppercase ${FOOD_COLORS[cat].text}`}>{por}</p>
                                   <p className={`text-[8px] font-bold opacity-40 ${FOOD_COLORS[cat].text}`}>{FOOD_WEIGHT_MAP[cat][por]}g</p>
                                 </div>
                                 
                                 <button 
                                   onClick={() => updateFoodQuantity(cat, por, 1)}
                                   className="w-10 h-12 flex items-center justify-center text-slate-400 hover:bg-white/40 active:text-slate-900"
                                 >
                                   <Plus size={16} strokeWidth={3} />
                                 </button>
                               </div>
                               
                               {qty > 0 && (
                                 <div className="absolute -top-2 -right-1">
                                   <span className={`${FOOD_COLORS[cat].accent} text-white text-[9px] min-w-[20px] h-[20px] flex items-center justify-center rounded-full font-black shadow-lg ring-2 ring-white`}>
                                     {qty}
                                   </span>
                                 </div>
                               )}
                             </div>
                           );
                        })}
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </main>
          <div className="fixed bottom-4 left-0 right-0 px-6 z-40">
            <button 
              disabled={!weightBefore || actionLoading} 
              onClick={saveEntry} 
              className="w-full py-4 bg-slate-900 disabled:bg-slate-200 text-white font-black rounded-xl shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><Check size={20}/> SAVE SESSION</>}
            </button>
          </div>
        </div>
      )}

      {(view === 'ADD_HAWK' || view === 'EDIT_HAWK') && (
        <div className="flex-1 flex flex-col h-screen">
          <main className="flex-1 overflow-y-auto p-6 space-y-8 animate-in slide-in-from-right-10 pb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setView(view === 'EDIT_HAWK' ? 'HAWK_DETAILS' : 'DASHBOARD')} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400"><ChevronLeft size={20}/></button>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                {view === 'EDIT_HAWK' ? 'EDIT' : 'NEW'} <span className="text-red-600">FALCON</span>
              </h2>
            </div>
            
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">NAME</label>
                <input 
                  value={hawkName} 
                  onChange={e => setHawkName(e.target.value)} 
                  placeholder="E.g. BOLT" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg focus:border-red-600 transition-all uppercase text-slate-900 placeholder:text-slate-300 outline-none" 
                />
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">SPECIES</label>
                <select 
                  value={hawkSpecies} 
                  onChange={e => setHawkSpecies(e.target.value)} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg uppercase outline-none focus:border-red-600 text-slate-900 appearance-none bg-no-repeat"
                >
                  {SPECIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">TARGET WEIGHT (g)</label>
                <input 
                  value={hawkTargetWeight} 
                  onChange={e => setHawkTargetWeight(e.target.value)} 
                  type="number" 
                  placeholder="000" 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-3xl focus:border-red-600 text-center text-slate-900 placeholder:text-slate-300 outline-none" 
                />
              </div>
              <button 
                disabled={actionLoading} 
                onClick={view === 'EDIT_HAWK' ? updateHawk : addHawk} 
                className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
              >
                {actionLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : (view === 'EDIT_HAWK' ? 'SAVE CHANGES' : 'ADD FALCON')}
              </button>
            </div>
          </main>
        </div>
      )}

    </div>
  );
};

export default App;