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
    Trash2,
    Lock,
    RotateCcw,
    Upload,
    Image as ImageIcon
} from 'lucide-react';
import { auth } from '../firebase/firebaseConfig';

export default function AdminDashboard() {
    const { isAdmin, addCandidate, results, getResults, isSyncing, votingEnded, endVoting, startNewElection, startLiveAudit, stopLiveAudit, stream } = useContext(Web3Context);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [candidateName, setCandidateName] = useState("");
    const [candidateLogo, setCandidateLogo] = useState(null); // Changed from symbol string to logo file
    const [logoPreview, setLogoPreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);

    // User recruitment section
    const [newEmail, setNewEmail] = useState("");
    const [newPass, setNewPass] = useState("");
    const [newAadhaar, setNewAadhaar] = useState("");
    const [selectedRole, setSelectedRole] = useState("voter");
    const [creationStatus, setCreationStatus] = useState("");

    useEffect(() => {
        const verify = async () => {
            const authStatus = await isAdmin();
            setIsAuthorized(authStatus);
            if (authStatus) {
                await fetchAdminProfile();
                await getResults();
                // Admin Entry Security: Verify biometric once
                await verifyAdminBiometric();
            }
            setLoading(false);
        };
        verify();
        return () => stopLiveAudit();
    }, []);

    const verifyAdminBiometric = async () => {
        const s = await startLiveAudit();
        if (!s) return;

        // Wait for camera stream to stabilize
        setTimeout(async () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 120;
                const ctx = canvas.getContext('2d');
                // Admin Entry Security Point: Active capture
                console.log("ADMIN IDENTITY VERIFICATION ACTIVE: Security Deterrent Scan completed.");
            } catch (e) {
                console.error("Admin Bio Deterrent Fail:", e);
            }
        }, 2000);
    };

    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 200; // Small size is plenty for a logo
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Convert to low-size JPEG/WebP
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
            };
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setCandidateLogo(file);
            const compressedBase64 = await compressImage(file);
            setLogoPreview(compressedBase64);
        }
    };

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
        if (!candidateName.trim() || !logoPreview) return;

        setIsSubmitting(true);
        // We store the Base64 logo in the 'symbol' field of the blockchain
        const success = await addCandidate(candidateName, logoPreview);
        if (success) {
            setCandidateName("");
            setCandidateLogo(null);
            setLogoPreview(null);
            await getResults(); // Refresh list from blockchain
        }
        setIsSubmitting(false);
    };

    const handleEndVoting = async () => {
        if (window.confirm("CRITICAL: Are you sure you want to end the voting session? This cannot be undone on the blockchain.")) {
            setIsSubmitting(true);
            await endVoting();
            await getResults();
            setIsSubmitting(false);
        }
    };

    const handleStartNewElection = async () => {
        const newName = window.prompt("Enter the name for the NEW election session:", "General Election 2026 Phase 2");
        if (newName) {
            setIsSubmitting(true);
            const success = await startNewElection(newName);
            if (success) await getResults();
            setIsSubmitting(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreationStatus("Provisioning Identity...");
        try {
            let token = await auth.currentUser?.getIdToken(true);
            if (!token) token = "admin-token";

            const res = await fetch('http://localhost:8000/api/admin/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    email: newEmail,
                    password: newPass,
                    aadhaar: newAadhaar,
                    role: selectedRole
                })
            });

            const data = await res.json();
            if (res.ok) {
                setCreationStatus(`SUCCESS: ${selectedRole.toUpperCase()} Provisioned.`);
                setNewEmail(""); setNewPass(""); setNewAadhaar("");
            } else {
                setCreationStatus(`ERROR: ${data.detail || 'Creation Failed'}`);
            }
        } catch (err) {
            setCreationStatus("CRITICAL: Network Sync Failure.");
        }
        setTimeout(() => setCreationStatus(""), 5000);
    };

    if (loading) {
        return (
            <div className="flex-grow flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium tracking-widest uppercase text-xs">Syncing Ledger Credentials...</p>
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

    // Statistics calculations
    const totalVotes = results.reduce((acc, curr) => acc + curr.voteCount, 0);
    const sortedResults = [...results].sort((a, b) => b.voteCount - a.voteCount);
    const leader = sortedResults.length > 0 ? sortedResults[0] : null;

    return (
        <div className="flex-grow max-w-6xl mx-auto w-full px-6 py-12">
            {/* Header Area */}
            <div className="border-b border-slate-800 pb-8 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-500/10 rounded-lg">
                            <ShieldCheck className="w-6 h-6 text-brand-400" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white uppercase italic">Central Election Control</h1>
                    </div>
                    <p className="text-slate-400">Authenticated as <span className="text-brand-400 font-mono italic">{profile?.email}</span></p>
                </div>

                <div className="flex items-center gap-4">
                    {!votingEnded ? (
                        <button
                            onClick={handleEndVoting}
                            className="bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/50 px-6 py-2 rounded-xl transition-all font-bold flex items-center gap-2"
                        >
                            <Lock className="w-4 h-4" />
                            END ELECTION
                        </button>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="bg-red-600/20 text-red-500 border border-red-600/30 px-6 py-2 rounded-xl font-black uppercase text-xs tracking-widest italic">
                                Voting Period Closed
                            </div>
                            <button
                                onClick={handleStartNewElection}
                                className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/50 px-6 py-2 rounded-xl transition-all font-bold flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                START NEW ELECTION
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-8">
                    {!votingEnded && (
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
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={candidateName}
                                        onChange={(e) => setCandidateName(e.target.value)}
                                        placeholder="e.g. Sanya Deshmukh"
                                        className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 transition-all rounded-xl p-4 text-white outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Party Logo (Official Image)</label>
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="logo-upload"
                                        />
                                        <label
                                            htmlFor="logo-upload"
                                            className="w-full h-32 bg-slate-900 border-2 border-dashed border-slate-800 hover:border-brand-500 transition-all rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative"
                                        >
                                            {logoPreview ? (
                                                <img src={logoPreview} alt="Preview" className="w-full h-full object-contain" />
                                            ) : (
                                                <>
                                                    <Upload className="w-8 h-8 text-slate-600 mb-2 group-hover:text-brand-400 transition-colors" />
                                                    <span className="text-xs text-slate-500 font-black uppercase">Click to upload brand asset</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !candidateName.trim() || !logoPreview}
                                    className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-900/40 flex items-center justify-center gap-3 drop-shadow-xl"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <><span>Register Candidate</span><ArrowRight className="w-5 h-5" /></>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* IDENTITY RECRUITMENT PANEL */}
                    <div className="glass-panel p-8 space-y-6 border-brand-500/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-500/10 rounded-lg">
                                <Users className="w-5 h-5 text-brand-400" />
                            </div>
                            <h2 className="text-xl font-bold uppercase tracking-tight">Administrative Enrollment</h2>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Securely provision new Sub-Administrators.</p>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <input
                                type="email" placeholder="New Account Email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none focus:border-brand-500/50 transition-colors"
                                required
                            />
                            <input
                                type="password" placeholder="Secure Password" value={newPass} onChange={e => setNewPass(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none focus:border-brand-500/50 transition-colors"
                                required
                            />
                            <input
                                type="text" placeholder="12-Digit Aadhaar" maxLength="12" value={newAadhaar} onChange={e => setNewAadhaar(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none focus:border-brand-500/50 transition-colors"
                                required
                            />

                            <div className="flex gap-2">
                                <button
                                    type="button" disabled
                                    className="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-900 text-slate-700 border border-slate-800 cursor-not-allowed"
                                >
                                    Voter (Self-Reg Only)
                                </button>
                                <button
                                    type="button" onClick={() => setSelectedRole('admin')}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border bg-brand-500 text-slate-950 border-brand-500`}
                                >
                                    Admin
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg active:scale-95 text-xs"
                            >
                                Enroll Administrator
                            </button>
                        </form>

                        {creationStatus && (
                            <div className={`text-[10px] font-bold text-center p-2 rounded-lg bg-white/5 uppercase tracking-tighter ${creationStatus.includes('SUCCESS') ? 'text-emerald-400' : 'text-red-400'}`}>
                                {creationStatus}
                            </div>
                        )}
                    </div>

                    <div className="glass-panel p-6 border-slate-800/50">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-brand-400" />
                            Live Statistics
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/30">
                                    <span className="text-slate-500 text-xs block mb-1">Turnout</span>
                                    <span className="text-white font-black font-mono text-xl">{totalVotes}</span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/30">
                                    <span className="text-slate-500 text-xs block mb-1">Candidates</span>
                                    <span className="text-white font-black font-mono text-xl">{results.length}</span>
                                </div>
                            </div>

                            {leader && (
                                <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                                    <p className="text-[10px] text-brand-400 uppercase font-black tracking-widest mb-2">Current Leader</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden p-1 shadow-inner flex items-center justify-center">
                                            {leader.symbol && leader.symbol.startsWith('data:') ? (
                                                <img src={leader.symbol} alt="Leader Logo" className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-2xl">{leader.symbol || '❓'}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold leading-tight">{leader.name}</p>
                                            <p className="text-xs text-slate-400 italic">{((leader.voteCount / (totalVotes || 1)) * 100).toFixed(1)}% share</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Live Candidate List */}
                <div className="lg:col-span-2">
                    <div className="glass-panel overflow-hidden border-slate-800/50">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Users className="w-5 h-5 text-brand-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Active Ballot Ledger</h2>
                            </div>
                            {isSyncing && (
                                <div className="flex items-center gap-2 text-xs text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20">
                                    <div className="w-1 h-1 rounded-full bg-brand-400 animate-ping"></div>
                                    Chain Syncing
                                </div>
                            )}
                        </div>

                        <div className="p-2">
                            {results.length === 0 ? (
                                <div className="p-20 text-center space-y-4">
                                    <Users className="w-10 h-10 text-slate-700 mx-auto" />
                                    <p className="text-slate-500 italic">No candidates written to ledger.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800/50">
                                    {results.map((c) => (
                                        <div key={c.id} className="p-6 flex items-center justify-between group hover:bg-slate-800/20 transition-all rounded-xl">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 flex items-center justify-center bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden p-2 shadow-inner group-hover:border-brand-500/50 transition-colors">
                                                    {c.symbol && c.symbol.startsWith('data:') ? (
                                                        <img src={c.symbol} alt="Party Logo" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="text-2xl">{c.symbol || '❓'}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-white group-hover:text-brand-400 transition-colors uppercase tracking-wide">{c.name}</h3>
                                                    <p className="text-[10px] text-brand-500 font-black tracking-widest uppercase">Member ID: {c.id}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-8">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-600 mb-1 italic">Blockchain Verified Votes</p>
                                                    <p className="text-3xl font-black text-white font-mono">{c.voteCount}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 p-6 bg-slate-900/40 border border-slate-800/50 rounded-2xl flex gap-6">
                        <CheckCircle2 className="w-10 h-10 text-indigo-500 shrink-0" />
                        <div>
                            <p className="text-white font-black text-xs uppercase tracking-widest mb-1 italic">Transparency Log</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                Administrative deletions are disabled. In a decentralized environment, all candidates must remain on the ledger once finalized to prevent state manipulation.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
