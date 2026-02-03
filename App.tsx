import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bird, Plus, ChevronLeft, Trash2, LogOut, 
  TrendingUp, Eye, EyeOff
} from 'lucide-react';
import { 
  Hawk, AppView, DailyEntry 
} from './types';
import { supabase, IS_MOCK_MODE } from './services/supabase';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hawkName, setHawkName] = useState('');
  const [hawkSpecies, setHawkSpecies] = useState(SPECIES_OPTIONS[0]);
  const [hawkTargetWeight, setHawkTargetWeight] = useState('');
  const [weightBefore, setWeightBefore] = useState('');

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
        .select('*, entries(*)')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const formattedHawks = data.map((h: any) => ({
        ...h,
        targetWeight: h.target_weight,
        entries: (h.entries || []).map((e: any) => ({
          ...e,
          weightBefore: e.weight_before,
          totalFoodWeight: e.total_food_weight,
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
      setHawkName(''); setView('DASHBOARD');
      setLoading(false);
      return;
    }

    try {
      await supabase.from('hawks').insert([{ 
        name: hawkName, 
        species: hawkSpecies, 
        target_weight: parseInt(hawkTargetWeight),
        user_id: user.id 
      }]);
      await loadData(user.id);
      setView('DASHBOARD');
    } finally {
      setLoading(false);
    }
  };

  const deleteHawkItem = async (id: string) => {
    if (!confirm('¿Eliminar este halcón?')) return;
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
    
    const newWeight = parseFloat(weightBefore);

    if (IS_MOCK_MODE) {
      const newEntry: DailyEntry = {
        id: Math.random().toString(),
        date: new Date().toISOString(),
        weightBefore: newWeight,
        totalFoodWeight: 0,
        foodSelections: []
      };
      const updatedHawks = hawks.map(h => h.id === selectedHawkId ? { ...h, entries: [newEntry, ...h.entries] } : h);
      saveDataLocally(updatedHawks);
      setWeightBefore(''); setView('HAWK_DETAILS');
      setLoading(false);
      return;
    }

    try {
      await supabase.from('entries').insert([{
        hawk_id: selectedHawkId,
        weight_before: newWeight,
        date: new Date().toISOString()
      }]);
      await loadData(user.id);
      setWeightBefore(''); setView('HAWK_DETAILS');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!selectedHawk) return [];
    return [...selectedHawk.entries].reverse().slice(-7).map(e => ({
      fecha: new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      peso: e.weightBefore
    }));
  }, [selectedHawk]);

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white text-slate-900 overflow-hidden md:shadow-[0_20px_50px_rgba(0,0,0,0.1)] md:my-4 md:rounded-[2.5rem] relative border-x border-slate-100">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      )}

      {view === 'AUTH' && (
        <div className="flex-1 flex flex-col p-8 justify-center items-center text-center max-w-md mx-auto w-full">
          <div className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-red-600/30 border-b-8 border-red-800">
            <Bird className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase">Falcon <span className="text-red-600">Pro</span></h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-12">Telemetry Control</p>
          <div className="w-full space-y-4">
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-600 font-bold text-lg" 
            />
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Contraseña" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-600 font-bold text-lg" 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
              </button>
            </div>
            <button onClick={() => handleAuth(true)} className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/10 text-xl tracking-widest uppercase border-b-4 border-red-800">Entrar</button>
          </div>
        </div>
      )}

      {view === 'DASHBOARD' && (
        <>
          <header className="p-8 md:p-10 flex justify-between items-center border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-black tracking-tighter uppercase">Estación de <span className="text-red-600">Vuelo</span></h2>
              <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{hawks.length} Halcones</p>
            </div>
            <button onClick={() => setView('ADD_HAWK')} className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg border-b-4 border-red-800"><Plus size={28}/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 bg-slate-50/20 no-scrollbar">
            {hawks.map(h => (
              <div key={h.id} onClick={() => { setSelectedHawkId(h.id); setView('HAWK_DETAILS'); }} className="bg-white border border-slate-100 p-6 rounded-[2rem] flex justify-between items-center shadow-sm cursor-pointer hover:border-red-600/30 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-red-600/5 text-red-600 rounded-2xl flex items-center justify-center"><Bird size={28}/></div>
                  <div>
                    <h3 className="font-black text-xl">{h.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{h.species}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black">{h.entries[0]?.weightBefore || '--'}<span className="text-xs text-red-600 ml-1">g</span></p>
                </div>
              </div>
            ))}
          </main>
          <footer className="p-6 border-t border-slate-100 flex justify-center">
            <button onClick={() => supabase.auth.signOut()} className="text-slate-200 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-red-600"><LogOut size={16}/> Salir del Terminal</button>
          </footer>
        </>
      )}

      {view === 'HAWK_DETAILS' && selectedHawk && (
        <>
          <header className="p-8 flex justify-between items-center border-b border-slate-100">
            <div className="flex items-center gap-5">
              <button onClick={() => setView('DASHBOARD')} className="p-3 bg-slate-50 rounded-2xl"><ChevronLeft size={24}/></button>
              <h2 className="font-black text-2xl uppercase tracking-tighter">{selectedHawk.name}</h2>
            </div>
            <button onClick={() => deleteHawkItem(selectedHawk.id)} className="text-slate-200 hover:text-red-600 transition-colors"><Trash2 size={24}/></button>
          </header>
          <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-600 p-7 rounded-[2.5rem] text-center text-white border-b-8 border-red-800">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Peso Actual</p>
                <p className="text-4xl font-black">{selectedHawk.entries[0]?.weightBefore || '--'}g</p>
              </div>
              <div className="bg-white border-2 border-slate-100 p-7 rounded-[2.5rem] text-center border-b-8 border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Vuelo</p>
                <p className="text-4xl font-black text-slate-900">{selectedHawk.targetWeight}g</p>
              </div>
            </div>

            <div className="h-64 bg-white rounded-[2rem] border border-slate-100 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="fecha" hide />
                  <YAxis hide domain={['dataMin - 20', 'dataMax + 20']} />
                  <Tooltip />
                  <Area type="monotone" dataKey="peso" stroke="#dc2626" fill="url(#redGrad)" strokeWidth={4} dot={{r: 4, fill: '#dc2626'}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {selectedHawk.entries.map(e => (
                <div key={e.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <span className="font-black text-slate-400 text-sm">{new Date(e.date).toLocaleDateString('es-ES', {day:'numeric', month:'short'})}</span>
                  <span className="font-black text-lg">{e.weightBefore}g</span>
                </div>
              ))}
            </div>
          </main>
          <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-center pointer-events-none">
            <button onClick={() => setView('ADD_ENTRY')} className="w-full max-w-sm py-6 bg-red-600 text-white font-black rounded-3xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all pointer-events-auto text-lg uppercase tracking-widest border-b-4 border-red-800">
              <TrendingUp size={24} /> Registrar Peso
            </button>
          </div>
        </>
      )}

      {view === 'ADD_ENTRY' && (
        <main className="flex-1 flex flex-col p-8 space-y-10 items-center justify-center">
          <button onClick={() => setView('HAWK_DETAILS')} className="absolute top-8 left-8 p-3 bg-slate-50 rounded-2xl"><ChevronLeft/></button>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Lectura Báscula (g)</label>
          <input 
            value={weightBefore} 
            onChange={e => setWeightBefore(e.target.value)} 
            type="number" 
            placeholder="0.0" 
            className="w-full max-w-xs p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] font-black text-center text-7xl outline-none focus:border-red-600" 
          />
          <button onClick={saveEntry} className="w-full max-w-xs py-6 bg-red-600 text-white font-black rounded-3xl shadow-2xl uppercase tracking-widest border-b-4 border-red-800">Confirmar</button>
        </main>
      )}

      {view === 'ADD_HAWK' && (
        <main className="p-8 space-y-6 flex-1 flex flex-col">
          <button onClick={() => setView('DASHBOARD')} className="w-fit p-3 bg-slate-50 rounded-2xl"><ChevronLeft/></button>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Nuevo Halcón</h2>
          <input value={hawkName} onChange={e => setHawkName(e.target.value)} placeholder="Nombre" className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold" />
          <select value={hawkSpecies} onChange={e => setHawkSpecies(e.target.value)} className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold">
            {SPECIES_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <input value={hawkTargetWeight} onChange={e => setHawkTargetWeight(e.target.value)} type="number" placeholder="Peso Objetivo (g)" className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold text-red-600" />
          <button onClick={addHawk} className="w-full py-6 bg-red-600 text-white font-black rounded-3xl mt-auto uppercase tracking-widest border-b-4 border-red-800">Registrar</button>
        </main>
      )}
    </div>
  );
};

export default App;