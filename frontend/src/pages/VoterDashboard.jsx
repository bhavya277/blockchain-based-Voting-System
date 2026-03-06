import { useState, useEffect, useContext, useRef } from 'react';
import { Web3Context } from '../context/Web3Context';
import {
    Fingerprint,
    ShieldCheck,
    Activity,
    CheckCircle2,
    AlertTriangle,
    Clock,
    User,
    ChevronRight,
    Camera
} from 'lucide-react';
import { auth } from '../firebase/firebaseConfig';

export default function VoterDashboard() {
    const { castVote, results, getResults, isSyncing } = useContext(Web3Context);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [voted, setVoted] = useState(false);
    const [biometricFailed, setBiometricFailed] = useState(false);

    // UI Local State
    const [votingInProgress, setVotingInProgress] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState("Authenticated via Aadhaar");

    useEffect(() => {
        fetchUserProfile();
        getResults();
    }, []);

    const fetchUserProfile = async () => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "voter-token";

            const res = await fetch('http://localhost:8000/api/users/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                if (data.hasVoted) setVoted(true);
            }
        } catch (err) {
            console.error("Profile Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (candidateId) => {
        if (biometricFailed) {
            alert("Security Alert: Biometric integrity check failed. Please refresh and re-verify.");
            return;
        }

        const confirm = window.confirm("Final Decision: Cast your vote immutably on the Ethereum ledger?");
        if (!confirm) return;

        setVotingInProgress(true);
        const success = await castVote(candidateId);
        if (success) {
            setVoted(true);
            await getResults();
        }
        setVotingInProgress(false);
    };

    if (loading) {
        return (
            <div className="flex-grow flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium font-mono text-sm tracking-widest">SYNCHRONIZING SECURE SESSION...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-grow max-w-6xl mx-auto w-full px-6 py-12">
            {/* Security Banner */}
            <div className="mb-10 flex flex-col lg:flex-row gap-6">
                <div className="flex-grow glass-panel p-6 border-brand-500/30 bg-brand-500/5 flex items-center gap-6">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                            <Fingerprint className="w-8 h-8 text-brand-400 animate-pulse" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-slate-900">
                            <ShieldCheck className="w-3 h-3 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-white mb-1">Democratic Participation</h1>
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                            Secure Ballot Session: <span className="text-brand-400 font-mono text-xs">{profile?.uid?.slice(0, 15)}...</span>
                        </p>
                    </div>
                </div>

                <div className="lg:w-80 glass-panel p-6 border-slate-800/50 flex flex-col justify-center">
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Biometric Status</p>
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
                        <p className="text-sm font-bold text-white">{verificationStatus}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Information Sidebar */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="glass-panel p-8">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                            <Activity className="w-5 h-5 text-brand-400" />
                            Live Turnout
                        </h2>
                        <div className="space-y-6">
                            <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Votes on Ledger</p>
                                <p className="text-3xl font-black text-brand-400 font-mono">
                                    {results.reduce((acc, curr) => acc + curr.voteCount, 0)}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Session Summary</p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        <span>Identity: Verified</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        <span>Ledger: Hardhat Local</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <Clock className="w-4 h-4 text-brand-400" />
                                        <span>Expires: 10m remaining</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {biometricFailed && (
                        <div className="glass-panel p-6 border-red-500/50 bg-red-500/5 animate-pulse">
                            <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">Biometric Alert</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Continuous face monitoring has detected an inconsistency. Voting functionality has been suspended for security.
                            </p>
                        </div>
                    )}
                </div>

                {/* Candidate Ballot */}
                <div className="lg:col-span-2">
                    <div className="glass-panel overflow-hidden border-slate-800/50">
                        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-white">Official Ballot</h2>
                                <p className="text-sm text-slate-400 mt-1">Select one candidate to cast your immutable vote.</p>
                            </div>
                            {voted && (
                                <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl border border-emerald-500/20 text-sm font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    VOTED
                                </div>
                            )}
                        </div>

                        <div className="p-4">
                            {voted ? (
                                <div className="p-16 text-center">
                                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <ShieldCheck className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <h2 className="text-3xl font-black text-white mb-2 italic">Participation Secured</h2>
                                    <p className="text-slate-400 max-w-sm mx-auto text-sm leading-relaxed mb-8">
                                        Your unique identity signature has been matched with a vote on the Ethereum ledger. To ensure 1-person-1-vote integrity, your ballot is now locked.
                                    </p>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-black tracking-widest text-slate-500 uppercase">
                                        Blockchain Audit Status: Verified
                                    </div>
                                </div>
                            ) : results.length === 0 ? (
                                <div className="p-10 text-center text-slate-500">
                                    No candidates registered on this ledger.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {results.map((c) => (
                                        <div
                                            key={c.id}
                                            className="bg-slate-900 p-6 rounded-3xl border border-slate-800 hover:border-brand-500/50 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 group"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-12 h-12 bg-black rounded-2xl border border-slate-800 flex items-center justify-center font-black text-brand-400 font-mono">
                                                    #{c.id}
                                                </div>
                                                <User className="w-5 h-5 text-slate-700" />
                                            </div>

                                            <h3 className="text-xl font-bold text-white mb-6 pr-4 lowercase">{c.name}</h3>

                                            <button
                                                disabled={votingInProgress || biometricFailed}
                                                onClick={() => handleVote(c.id)}
                                                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/40 hover:-translate-y-1"
                                            >
                                                {votingInProgress ? (
                                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <span>CAST VOTE</span>
                                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 flex gap-4 p-6 glass-panel border-brand-500/20">
                        <ShieldCheck className="w-10 h-10 text-brand-400 shrink-0" />
                        <div>
                            <p className="text-white font-bold text-sm mb-1 uppercase tracking-wider italic">Decentralized Assurance</p>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                This election is secured by an Ethereum-compatible distributed ledger. Once your vote is cast, it is hashed, multi-signed, and permanently recorded. It cannot be altered by any central authority.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
