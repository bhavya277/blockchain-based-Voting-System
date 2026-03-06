import { useContext, useEffect, useState } from 'react';
import { Web3Context } from '../context/Web3Context';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { Loader2, RefreshCw, BarChart3, TrendingUp, Users, ShieldCheck } from 'lucide-react';

export default function Results() {
    const { getResults, isSyncing } = useContext(Web3Context);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchResults = async () => {
        try {
            setLoading(true);
            const res = await getResults();
            if (res) {
                const formatted = res.map(c => ({
                    name: c.name,
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
        // Auto refresh every 15 seconds to sync with block productions
        const interval = setInterval(fetchResults, 15000);
        return () => clearInterval(interval);
    }, []);

    const totalVotes = data.reduce((acc, curr) => acc + curr.votes, 0);

    return (
        <div className="flex-grow max-w-6xl mx-auto w-full px-6 py-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-500/10 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-brand-400" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white">Live Election Ledger</h1>
                    </div>
                    <p className="text-slate-400">Real-time immutable data stream from the Ethereum network.</p>
                </div>
                <button
                    onClick={fetchResults}
                    className="glass-panel px-6 py-3 flex items-center gap-3 hover:bg-slate-800 transition-all border-slate-700/50"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing || loading ? 'animate-spin text-brand-400' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-300">Sync Ledger</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-10">
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 bg-brand-500/5 border-brand-500/20">
                        <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Total Cast Votes</p>
                        <h2 className="text-4xl font-black text-brand-400 font-mono mb-2">
                            {totalVotes}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-brand-500/70">
                            <TrendingUp className="w-3 h-3" />
                            <span>Incorruptible Tally</span>
                        </div>
                    </div>

                    <div className="glass-panel p-6 border-slate-800/50">
                        <div className="flex items-center gap-3 mb-4">
                            <Users className="w-4 h-4 text-brand-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Voter Engagement</h3>
                        </div>
                        <div className="space-y-4">
                            {data.map((entry, index) => (
                                <div key={entry.name} className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-medium">{entry.name}</span>
                                        <span className="text-brand-400 font-bold">{totalVotes > 0 ? Math.round((entry.votes / totalVotes) * 100) : 0}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/30">
                                        <div
                                            className="h-full bg-brand-500 rounded-full transition-all duration-1000 ease-out"
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
                        <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            Distribution Visualization
                        </h3>
                        <div className="flex-grow min-h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <XAxis
                                        dataKey="name"
                                        stroke="#1e293b"
                                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        stroke="#1e293b"
                                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#0f172a', radius: 16 }}
                                        contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ color: '#2dd4bf', fontWeight: '900', fontSize: '14px' }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em' }}
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

            <div className="p-8 glass-panel border-brand-500/20 bg-brand-500/5 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                <div className="w-16 h-16 bg-brand-500/10 rounded-[1.5rem] flex items-center justify-center shrink-0 border border-brand-500/30">
                    <ShieldCheck className="w-8 h-8 text-brand-400" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-white italic tracking-tight italic">Blockchain Verification Complete</h3>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                        These results are pulled directly from the decentralized ledger. Any attempt to modify the vote counts on the server side will be instantly detected and rejected by the Ethereum protocol nodes.
                    </p>
                </div>
            </div>
        </div>
    );
}
