import { useState, useEffect, useContext } from 'react';
import { Web3Context } from '../context/Web3Context';
import {
    Users,
    Plus,
    ArrowRight,
    ShieldCheck,
    Activity,
    ExternalLink,
    AlertTriangle,
    CheckCircle2,
    Trash2
} from 'lucide-react';
import { auth } from '../firebase/firebaseConfig';

export default function AdminDashboard() {
    const { isAdmin, addCandidate, results, getResults, isSyncing } = useContext(Web3Context);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [candidateName, setCandidateName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const verify = async () => {
            const authStatus = await isAdmin();
            setIsAuthorized(authStatus);
            if (authStatus) {
                await fetchAdminProfile();
                await getResults();
            }
            setLoading(false);
        };
        verify();
    }, []);

    const fetchAdminProfile = async () => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "admin-token";

            const res = await fetch('http://localhost:8000/api/users/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch (err) {
            console.error("Profile Fetch Error:", err);
        }
    };

    const handleAddCandidate = async (e) => {
        e.preventDefault();
        if (!candidateName.trim()) return;

        setIsSubmitting(true);
        const success = await addCandidate(candidateName);
        if (success) {
            setCandidateName("");
            await getResults(); // Refresh list from blockchain
        }
        setIsSubmitting(false);
    };

    if (loading) {
        return (
            <div className="flex-grow flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium">Syncing Ledger Credentials...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex-grow flex items-center justify-center p-4">
                <div className="glass-panel p-10 max-w-md w-full text-center space-y-4 border-red-500/50">
                    <AlertTriangle className="w-16 h-16 mx-auto text-red-500" />
                    <h2 className="text-2xl font-bold">Access Restricted</h2>
                    <p className="text-slate-400">Your current credentials do not have administrative privileges over the Ethereum ledger.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-grow max-w-6xl mx-auto w-full px-6 py-12">
            {/* Header Area */}
            <div className="border-b border-slate-800 pb-8 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-500/10 rounded-lg">
                            <ShieldCheck className="w-6 h-6 text-brand-400" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Central Election Control</h1>
                    </div>
                    <p className="text-slate-400">Authenticated as <span className="text-brand-400 font-mono">{profile?.email}</span></p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Blockchain Relayer</p>
                        <p className="text-xs font-mono text-brand-400 flex items-center justify-end gap-2">
                            Status: Secured <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="glass-panel p-8 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <Plus className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-bold">New Candidate</h2>
                        </div>
                        <p className="text-sm text-slate-400">This will create a dedicated index for this candidate on the decentralized ledger.</p>

                        <form onSubmit={handleAddCandidate} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Candidate Full Name</label>
                                <input
                                    type="text"
                                    value={candidateName}
                                    onChange={(e) => setCandidateName(e.target.value)}
                                    placeholder="e.g. Sanya Deshmukh"
                                    className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 transition-all rounded-xl p-4 text-white placeholder:text-slate-700 outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || !candidateName.trim()}
                                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-900/40 flex items-center justify-center gap-3 drop-shadow-xl"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>Syncing Ledger...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Add to Ledger</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="glass-panel p-6 border-slate-800/50">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-brand-400" />
                            System Statistics
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/50 border border-slate-800/30">
                                <span className="text-slate-400 text-sm">Candidates</span>
                                <span className="text-white font-bold font-mono">{results.length}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/50 border border-slate-800/30">
                                <span className="text-slate-400 text-sm">Network</span>
                                <span className="text-brand-400 font-bold font-mono text-xs">Ethereum (Hardhat)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Candidate List */}
                <div className="lg:col-span-2">
                    <div className="glass-panel overflow-hidden border-slate-800/50">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Users className="w-5 h-5 text-brand-400" />
                                <h2 className="text-xl font-bold">Immutably Registered Candidates</h2>
                            </div>
                            {isSyncing && (
                                <div className="flex items-center gap-2 text-xs text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20">
                                    <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></div>
                                    Syncing
                                </div>
                            )}
                        </div>

                        <div className="p-2">
                            {results.length === 0 ? (
                                <div className="p-20 text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
                                        <Users className="w-6 h-6 text-slate-700" />
                                    </div>
                                    <p className="text-slate-500">No candidates have been written to the blockchain yet.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800/50">
                                    {results.map((c) => (
                                        <div key={c.id} className="p-6 flex items-center justify-between group hover:bg-slate-800/30 transition-all rounded-xl">
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 flex items-center justify-center bg-slate-900 rounded-2xl border border-slate-800 text-brand-400 font-bold font-mono">
                                                    #{c.id}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">{c.name}</h3>
                                                    <p className="text-xs text-slate-500 font-mono mt-0.5">Hash: {btoa(c.name).slice(0, 16)}...</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-8">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-600 mb-1">Votes Recorded</p>
                                                    <p className="text-2xl font-black text-brand-400 font-mono">{c.voteCount}</p>
                                                </div>
                                                <button className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex gap-4">
                        <ShieldCheck className="w-6 h-6 text-yellow-500 shrink-0" />
                        <div>
                            <p className="text-yellow-500/90 text-sm font-bold mb-1">Blockchain Security Protocol</p>
                            <p className="text-yellow-500/70 text-xs leading-relaxed">
                                All deletions have been disabled for this MVP. Candidates written to the Ethereum ledger are immutable and cannot be removed to ensure election integrity.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
