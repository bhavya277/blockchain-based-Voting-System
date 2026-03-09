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
    Camera,
    Lock
} from 'lucide-react';
import { auth } from '../firebase/firebaseConfig';

export default function VoterDashboard() {
    const proctoringVideoRef = useRef(null);
    const { castVote, results, getResults, isSyncing, startLiveAudit, stopLiveAudit, stream } = useContext(Web3Context);
    const checkingRef = useRef(false);

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [voted, setVoted] = useState(false);
    const [biometricFailed, setBiometricFailed] = useState(false);
    const [votingInProgress, setVotingInProgress] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState("Authenticated via Aadhaar");

    const [alertShown, setAlertShown] = useState(false);
    const lockdownRef = useRef(false);

    useEffect(() => {
        fetchUserProfile();
        getResults();

        // Start Security Services
        startLiveAudit();

        // High-Precision Retina Pulse (Lock-step 1 second)
        // We use a recursive timeout to ensure no overlapping requests while maintaining 1s frequency
        let active = true;
        const runCheck = async () => {
            if (!active) return;

            // KILL SWITCH: If session is locked, stop all background scanning instantly.
            if (lockdownRef.current) return;

            const startTime = Date.now();
            await performIdentityCheck(true);
            const elapsed = Date.now() - startTime;
            // 500ms for ULTRA-HIGH frequency (Real-time tracking)
            const delay = Math.max(0, 500 - elapsed);

            // Only schedule next check if we are still active AND not locked out
            if (active && !lockdownRef.current) {
                setTimeout(runCheck, delay);
            }
        };
        runCheck();

        // 2. Full Bio-Sync (Every 15 seconds) - Periodic Deep Check
        const heavyInterval = setInterval(() => {
            performIdentityCheck(false);
        }, 15000);

        return () => {
            active = false;
            clearInterval(heavyInterval);
            stopLiveAudit();
        };
    }, [profile?.email]);

    useEffect(() => {
        if (stream && proctoringVideoRef.current) {
            proctoringVideoRef.current.srcObject = stream;
        }
    }, [stream]);

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

    const [isReVerifying, setIsReVerifying] = useState(false);

    const performIdentityCheck = async (isFastMode = true, isManualTrigger = false) => {
        if (!proctoringVideoRef.current || !stream || !profile?.email || checkingRef.current) return;

        // CRITICAL SECURITY STOP: Using lockdownRef for ATOMIC state check.
        // If locked, zero network activity until manual trigger.
        if (lockdownRef.current && !isManualTrigger) return;

        checkingRef.current = true;
        if (!isFastMode) setIsReVerifying(true);

        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(proctoringVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.4); // Lower quality = Instant Speed

        try {
            const formData = new FormData();
            formData.append('face_image', dataUrl);
            formData.append('uid', profile.email);

            // If fast mode, use the light liveness endpoint. Otherwise use the heavy one.
            const endpoint = isFastMode ? '/api/biometric/continuous-verify' : '/api/verify-face';

            const res = await fetch(`http://localhost:8000${endpoint}`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.status === "success" && data.verified) {
                if (!lockdownRef.current || isManualTrigger) {
                    setBiometricFailed(false);
                    lockdownRef.current = false;
                    setVerificationStatus(isFastMode ? "Secured: Retina Tracking Active" : "Full Identity Re-Verified");
                }
            } else {
                setBiometricFailed(true);
                lockdownRef.current = true;
                setVerificationStatus("SECURITY BREACH: Unauthorized Access");
            }
        } catch (err) {
            setBiometricFailed(true);
            lockdownRef.current = true; // Fail-safe: block if network/server error occurs
        } finally {
            checkingRef.current = false;
            setIsReVerifying(false);
        }
    };

    const handleVote = async (candidateId) => {
        if (biometricFailed) {
            alert("Security Alert: Biometric integrity check failed. Please ensure your face is visible and matches your registration.");
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
        <div className={`flex-grow max-w-6xl mx-auto w-full px-6 py-12 relative min-h-screen ${biometricFailed ? 'pointer-events-none select-none cursor-not-allowed' : ''}`}>

            {/* FULL SCREEN SECURITY LOCKDOWN OVERLAY (BALLOT RECOVERY) */}
            {biometricFailed && (
                <div className="fixed inset-0 z-[1000] bg-slate-950/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 pointer-events-auto cursor-default">
                    <div className="w-24 h-24 mb-6 rounded-full bg-red-500/10 border border-red-500/50 flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                        <Lock className="w-12 h-12 text-red-500 animate-pulse" />
                    </div>

                    <h1 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">Ballot Access Verification</h1>
                    <p className="text-red-400 font-mono text-[10px] uppercase tracking-widest max-w-md mb-8 leading-relaxed font-bold">
                        Mismatch Detected. Please center your face to unlock the ballot.
                    </p>

                    <div className="flex flex-col gap-6 w-full max-w-md text-center items-center">
                        {/* High Visibility Recovery Camera (Similar to Login) */}
                        <div className="relative w-full aspect-video rounded-3xl overflow-hidden border-2 border-red-500/50 bg-black shadow-2xl">
                            <video
                                ref={(el) => {
                                    if (el && stream) el.srcObject = stream;
                                }}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover scale-x-[-1]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-4 left-4 flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                <span className="text-[10px] text-white font-black uppercase tracking-widest">Awaiting Identity Match</span>
                            </div>
                        </div>

                        <button
                            disabled={isReVerifying}
                            onClick={(e) => {
                                e.stopPropagation();
                                performIdentityCheck(false, true); // Force heavy check + Manual Trigger
                            }}
                            className={`w-full py-4 ${isReVerifying ? 'bg-slate-800' : 'bg-red-600 hover:bg-red-500'} text-white font-extrabold rounded-2xl transition-all flex items-center justify-center gap-3 group shadow-2xl shadow-red-600/30 active:scale-95 border-b-4 border-slate-900/50`}
                        >
                            {isReVerifying ? (
                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Camera className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                            )}
                            {isReVerifying ? 'AUTHENTICATING...' : 'MANUAL IDENTITY RE-SCAN'}
                        </button>

                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl w-full">
                            <p className="text-[10px] text-slate-400 text-center leading-relaxed font-medium uppercase tracking-tighter">
                                Secure Mode: Automatic unlock is disabled for safety. <br /> Tap the button above to manually re-verify and return to your ballot.
                            </p>
                        </div>
                    </div>

                    <div className="mt-16 py-3 px-6 border border-white/5 rounded-full bg-white/5 text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] flex items-center gap-3">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Blockchain Audit Protected
                    </div>
                </div>
            )}

            {/* Live Global Proctoring Camera (Top Left) */}
            <div className="fixed top-24 left-6 z-50 group">
                <div className={`w-40 h-40 rounded-2xl overflow-hidden border-2 shadow-2xl transition-all duration-500 ${biometricFailed ? 'border-red-500 scale-105' : 'border-brand-500/40'}`}>
                    <video ref={proctoringVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl" />
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${biometricFailed ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-500 text-slate-900'}`}>
                        {biometricFailed ? 'SECURITY ALERT' : 'LIVE AUDIT'}
                    </div>
                    {biometricFailed && (
                        <div className="absolute inset-0 bg-red-500/20 animate-pulse flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-white" />
                        </div>
                    )}
                </div>
            </div>

            {/* Security Banner */}
            <div className="mb-10 flex flex-col lg:flex-row gap-6 ml-48">
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
                        <div className={`w-2.5 h-2.5 rounded-full ${biometricFailed ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'}`}></div>
                        <p className={`text-sm font-bold ${biometricFailed ? 'text-red-400' : 'text-white'}`}>{verificationStatus}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 ml-48">
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
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_5px_red] ${biometricFailed ? 'bg-red-600 shadow-[0_0_10px_red]' : 'bg-red-500 shadow-[0_0_5px_red]'}`} />
                                        <span className={`font-bold text-xs ${biometricFailed ? 'text-red-500' : 'text-red-400'}`}>Biometric Proctoring: {biometricFailed ? 'CRITICAL ALERT' : 'ACTIVE'}</span>
                                    </div>
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
                                            <div className="flex items-center gap-4 mb-6">
                                                <div className="w-16 h-16 bg-black rounded-2xl border border-slate-800 flex items-center justify-center p-2 shadow-inner group-hover:border-brand-500/50 transition-colors">
                                                    {c.symbol && c.symbol.startsWith('data:') ? (
                                                        <img src={c.symbol} alt="Logo" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="text-2xl">{c.symbol || '❓'}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">{c.name}</h3>
                                                    <p className="text-[10px] text-brand-500 font-black tracking-widest uppercase">Ballot Index #{c.id}</p>
                                                </div>
                                            </div>

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

                    <div className="mt-8 flex gap-4 p-6 glass-panel border-brand-500/20 ml-0">
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
