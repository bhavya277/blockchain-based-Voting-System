import { useContext, useEffect, useState } from 'react';
import { Web3Context } from '../context/Web3Context';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { Loader2, RefreshCw, BarChart3, TrendingUp, Users, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function Results() {
    const { getResults, isSyncing, votingEnded } = useContext(Web3Context);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchResults = async () => {
        try {
            setLoading(true);
            const res = await getResults();
            if (res) {
                const formatted = res.map(c => ({
                    name: c.name,
                    symbol: c.symbol,
                    votes: c.voteCount
                }));
                setData(formatted);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResults();
        const interval = setInterval(fetchResults, 15000);
        return () => clearInterval(interval);
    }, []);

    const totalVotes = data.reduce((acc, curr) => acc + curr.votes, 0);

    // Lock screen if voting is still active
    if (!votingEnded) {
        return (
            <div className="flex-grow flex items-center justify-center p-6">
                <div className="glass-panel p-12 max-w-xl w-full text-center space-y-8 border-brand-500/30">
                    <div className="relative">
                        <div className="absolute inset-0 bg-brand-500/20 blur-3xl rounded-full" />
                        <ShieldCheck className="w-20 h-20 mx-auto text-brand-400 relative" />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Election in Progress</h2>
                        <p className="text-slate-400 text-lg">Blockchain results are sealed until the election commission officially closes the voting period.</p>
                    </div>
                    <div className="pt-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full border border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <RefreshCw className="w-3 h-3 animate-spin text-brand-500" />
                            Awaiting Decentralized Finality
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-grow max-w-6xl mx-auto w-full px-6 py-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-500/10 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-brand-400" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Official Results Ledger</h1>
                    </div>
                    <p className="text-slate-400">Final immutable data stream from the Ethereum network.</p>
                </div>
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-6 py-2 rounded-xl font-black uppercase text-xs tracking-widest italic flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Certified Final
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-10">
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 bg-brand-500/5 border-brand-500/20">
                        <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Total Verified Turnout</p>
                        <h2 className="text-4xl font-black text-brand-400 font-mono mb-2">
                            {totalVotes}
                        </h2>
                    </div>

                    <div className="glass-panel p-6 border-slate-800/50">
                        <div className="flex items-center gap-3 mb-6">
                            <TrendingUp className="w-4 h-4 text-brand-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-tight italic">Share Distribution</h3>
                        </div>
                        <div className="space-y-6">
                            {data.map((entry) => (
                                <div key={entry.name} className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden p-1 flex items-center justify-center">
                                                {entry.symbol && entry.symbol.startsWith('data:') ? (
                                                    <img src={entry.symbol} alt="Logo" className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-sm">{entry.symbol || '❓'}</span>
                                                )}
                                            </div>
                                            <span className="text-white font-bold">{entry.name}</span>
                                        </div>
                                        <span className="text-brand-400 font-black">{totalVotes > 0 ? Math.round((entry.votes / totalVotes) * 100) : 0}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/30">
                                        <div
                                            className="h-full bg-brand-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(45,212,191,0.5)]"
                                            style={{ width: `${totalVotes > 0 ? (entry.votes / totalVotes) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <div className="glass-panel p-8 h-full border-slate-800/50 flex flex-col">
                        <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3 italic">
                            <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                            Blockchain Visual Audit
                        </h3>
                        <div className="flex-grow min-h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <XAxis
                                        dataKey="name"
                                        stroke="#1e293b"
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        cursor={{ fill: '#0f172a', radius: 16 }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-2xl">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <div className="w-10 h-10 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden p-1 flex items-center justify-center">
                                                                {payload[0].payload.symbol && payload[0].payload.symbol.startsWith('data:') ? (
                                                                    <img src={payload[0].payload.symbol} alt="Logo" className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <span className="text-xl">{payload[0].payload.symbol || '❓'}</span>
                                                                )}
                                                            </div>
                                                            <p className="text-white font-black uppercase text-sm">{payload[0].payload.name}</p>
                                                        </div>
                                                        <p className="text-brand-400 font-black font-mono text-lg">{payload[0].value} <span className="text-[10px] text-slate-500">VOTES RECORDED</span></p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="votes" radius={[12, 12, 0, 0]} barSize={60}>
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2dd4bf' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 glass-panel border-emerald-500/20 bg-emerald-500/5 rounded-[2rem] flex flex-col md:flex-row items-center gap-8">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-[1.5rem] flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-white italic tracking-tight italic">Audit Complete: Immutability Verified</h3>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                        The election session is closed. Results are locked and distributed across Ethereum nodes. No individual, admin, or government body can alter these certified counts.
                    </p>
                </div>
            </div>
        </div>
    );
}
