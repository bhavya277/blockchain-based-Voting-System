import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase/firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Shield, Fingerprint, Mail, Lock, CheckCircle, ArrowRight, Loader2, Upload, Camera, Smartphone, Key, Search } from 'lucide-react';

const AuthPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const role = searchParams.get('role') || 'voter';
    const mode = searchParams.get('mode') || 'login';

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [aadhaar, setAadhaar] = useState('');
    const [voterId, setVoterId] = useState('');

    // Aadhaar Verification States
    const [step, setStep] = useState(1); // 1: Info, 2: Upload, 3: Scanning, 4: OTP, 5: Verified
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [voterCardFile, setVoterCardFile] = useState(null);
    const [voterCardPreview, setVoterCardPreview] = useState(null);
    const [extractedMobile, setExtractedMobile] = useState('');
    const [otp, setOtp] = useState('');

    // Phase Tracking (1: Aadhaar, 2: Email, 3: Face, 4: Credentials)
    const [verificationStep, setVerificationStep] = useState(1);
    const [aadhaarVerified, setAadhaarVerified] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [faceVerified, setFaceVerified] = useState(false);

    // Email OTP states
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailOtp, setEmailOtp] = useState("");
    const [isEmailOtpLoading, setIsEmailOtpLoading] = useState(false);

    // Camera states
    const [faceCaptured, setFaceCaptured] = useState(null);
    const [stream, setStream] = useState(null);
    const videoRef = useRef(null);

    // Skip identity verification for returning users (Login mode)
    useEffect(() => {
        if (mode === 'login') {
            setAadhaarVerified(true);
            setEmailVerified(true);
            setFaceVerified(true);
            setVerificationStep(4);
        } else {
            // Reset for Signup mode
            setAadhaarVerified(false);
            setEmailVerified(false);
            setFaceVerified(false);
            setVerificationStep(1);
        }
    }, [mode]);

    const apiBase = 'http://localhost:8000';

    // UI States
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const simulateScanning = async (fileToScan) => {
        const file = fileToScan || selectedFile;

        if (!aadhaar || (aadhaar.length !== 12 && aadhaar !== "00000000000")) {
            setError("Please enter your correct 12-digit Aadhaar number (or use 00000000000 for test bypass).");
            return;
        }

        if (!file) {
            setError("Please upload your Aadhaar card image first.");
            return;
        }

        setStep(3);
        setVerifying(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('aadhaar_number', aadhaar);

        try {
            console.log(`Calling verify-aadhaar at ${apiBase}/api/verify-aadhaar`);
            const response = await fetch(`${apiBase}/api/verify-aadhaar`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Verification failed');
            }

            setExtractedMobile(data.linkedMobile);
            setStep(4);
        } catch (err) {
            console.error("OCR Error:", err);
            setError(`Verification Failed: ${err.message}`);
            setStep(2);
        } finally {
            setVerifying(false);
        }
    };

    const handleBypass = () => {
        setAadhaar("000000000000");
        setVoterId("TEST123456");
        setEmail("testuser@example.com"); // Pre-fill email for bypass
        setExtractedMobile("9876541234");  // Pre-fill mobile
        setAadhaarVerified(true);
        setEmailVerified(true);
        setFaceVerified(true);
        setVerificationStep(4);
        setStep(5);
        setError("TEST MODE: Identity verified via bypass. Password is required below.");
    };

    const handleVerifyOtp = async () => {
        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('aadhaar_number', aadhaar);
            formData.append('otp', otp);

            const response = await fetch(`${apiBase}/api/verify-otp`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Invalid OTP');

            setStep(5);
            setAadhaarVerified(true);
            setVerificationStep(2);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmailOtp = async () => {
        if (!email) {
            setError("Please enter email first");
            return;
        }
        setIsEmailOtpLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('email', email);
            const res = await fetch(`${apiBase}/api/send-email-otp`, { method: 'POST', body: formData });
            if (res.ok) {
                setEmailOtpSent(true);
                setError("");
            } else {
                const data = await res.json();
                throw new Error(data.detail || "Failed to send email OTP");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsEmailOtpLoading(false);
        }
    };

    const handleVerifyEmailOtp = async () => {
        setIsEmailOtpLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('otp', emailOtp);
            const res = await fetch(`${apiBase}/api/verify-email-otp`, { method: 'POST', body: formData });
            if (res.ok) {
                setEmailVerified(true);
                setVerificationStep(3);
                setError("");
            } else {
                const data = await res.json();
                throw new Error(data.detail || "Invalid Email OTP");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsEmailOtpLoading(false);
        }
    };

    const startCamera = async () => {
        setError('');
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });
            setStream(s);
            // srcObject will be handled by useEffect
        } catch (err) {
            setError("Camera access denied or device not found.");
            console.error("Camera error:", err);
        }
    };

    // Correctly bind stream to video element when it mounts/updates
    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            // Ensure the video plays immediately
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play().catch(e => console.error("Auto-play failed:", e));
            };
        }
    }, [stream]);

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const captureFace = async () => {
        if (!videoRef.current || !stream) {
            setError("Camera not ready.");
            return;
        }

        // Check if video is actually playing and has dimensions
        if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
            setError("Wait for camera to initialize...");
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFaceCaptured(dataUrl);
        stopCamera();

        setLoading(true);
        setError('');
        try {
            const blob = await (await fetch(dataUrl)).blob();
            const formData = new FormData();
            formData.append('face_image', blob, 'face.jpg');
            formData.append('uid', email);

            const res = await fetch(`${apiBase}/api/verify-face`, { method: 'POST', body: formData });
            if (res.ok) {
                setFaceVerified(true);
                setVerificationStep(4);
            } else {
                const data = await res.json();
                throw new Error(data.detail || "Face verification failed");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        if (!aadhaarVerified || !emailVerified || !faceVerified) {
            setError('Please complete all verification steps.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // TEST BYPASS: Skip Firebase if using the test Aadhaar
            if (aadhaar === "000000000000") {
                console.log("TEST MODE: Skipping Firebase Auth");
                // Simulate a small delay for realism
                await new Promise(resolve => setTimeout(resolve, 800));
                navigate(role === 'admin' ? '/admin' : '/voter/dashboard');
                return;
            }

            if (mode === 'signup') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const token = await user.getIdToken();

                const regResponse = await fetch(`${apiBase}/api/voters/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        email, role, aadhaar: aadhaar.replace(/\d(?=\d{4})/g, "*"),
                        voter_id: voterId, mobile: extractedMobile, wallet_address: "not-connected"
                    })
                });

                if (!regResponse.ok) throw new Error('Backend sync failed');
                navigate(role === 'admin' ? '/admin' : '/voter/dashboard');
            } else {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const token = await user.getIdToken();

                const profileRes = await fetch(`${apiBase}/api/users/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!profileRes.ok) throw new Error('Could not verify account details.');
                const profile = await profileRes.json();
                if (profile.role !== role) throw new Error(`Incorrect role.`);
                navigate(role === 'admin' ? '/admin' : '/voter/dashboard');
            }
        } catch (err) {
            console.error("Auth Error:", err);
            let message = err.message;
            if (err.code === 'auth/email-already-in-use') message = "Email already registered. Login instead.";
            else if (err.code === 'auth/invalid-email') message = "Please enter a valid email address.";
            else if (err.code === 'auth/weak-password') message = "Password must be at least 6 characters.";
            else if (err.code === 'auth/user-not-found') message = "No account found with this email.";
            else if (err.code === 'auth/wrong-password') message = "Incorrect password.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const themeColor = role === 'voter' ? 'blue' : 'emerald';

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-20 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-96 h-96 bg-${themeColor}-500/10 rounded-full blur-[120px] -z-10 animate-pulse`} />
            <div className={`absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10`} />

            <div className="max-w-md w-full glass-panel p-8 md:p-10 relative z-10">
                <div className="flex justify-center mb-8">
                    <div className={`p-4 rounded-2xl bg-${themeColor}-500/20 ring-1 ring-${themeColor}-500/50`}>
                        {role === 'admin' ? <Shield className="w-10 h-10 text-emerald-400" /> : <Fingerprint className="w-10 h-10 text-blue-400" />}
                    </div>
                </div>

                <h2 className="text-3xl font-extrabold text-white text-center mb-2">{mode === 'login' ? 'Welcome Back' : 'Secure Registration'}</h2>
                <p className="text-slate-400 text-center mb-8">{role.charAt(0).toUpperCase() + role.slice(1)} Identity Verification</p>

                <div className="flex flex-col gap-4">
                    <button type="button" onClick={handleBypass} className="text-[10px] uppercase tracking-widest font-bold text-slate-600 hover:text-blue-400 self-center border border-slate-800 px-3 py-1 rounded-full transition-colors">Skip to Credentials (Test Mode)</button>

                    <form onSubmit={handleAuth} className="space-y-6">
                        {verificationStep === 1 && (
                            <div className="space-y-6 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50">
                                {step <= 2 && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Aadhaar Number</label>
                                                <input
                                                    type="text" maxLength="12" placeholder="Aadhaar Number" value={aadhaar}
                                                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Voter ID (EPIC)</label>
                                                <input
                                                    type="text" placeholder="Voter ID" value={voterId}
                                                    onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div onClick={() => fileInputRef.current.click()} className="group cursor-pointer border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl p-4 text-center transition-all">
                                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                                                <div className="flex flex-col items-center">
                                                    <Camera className="w-5 h-5 text-slate-400 group-hover:text-blue-400 mb-2" />
                                                    <p className="text-xs font-semibold text-slate-300">Aadhaar Card</p>
                                                    {previewUrl && <p className="text-[10px] text-emerald-400 mt-1">✓ Selected</p>}
                                                </div>
                                            </div>
                                            <div onClick={() => document.getElementById('voter-file').click()} className="group cursor-pointer border-2 border-dashed border-slate-700 hover:border-purple-500/50 rounded-2xl p-4 text-center transition-all">
                                                <input id="voter-file" type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                    const f = e.target.files[0];
                                                    if (f) { setVoterCardFile(f); setVoterCardPreview(URL.createObjectURL(f)); }
                                                }} />
                                                <div className="flex flex-col items-center">
                                                    <Upload className="w-5 h-5 text-slate-400 group-hover:text-purple-400 mb-2" />
                                                    <p className="text-xs font-semibold text-slate-300">Voter Card</p>
                                                    {voterCardPreview && <p className="text-[10px] text-emerald-400 mt-1">✓ Selected</p>}
                                                </div>
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => simulateScanning()} disabled={verifying} className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group">
                                            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 group-hover:scale-110" />Start AI Verification</>}
                                        </button>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-4 py-4 text-center">
                                        <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto" />
                                        <p className="text-sm font-mono text-blue-400 animate-pulse">AI SCANNING BIOMETRICS...</p>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="space-y-4">
                                        <div className="text-center">
                                            <Smartphone className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                                            <p className="text-xs text-slate-400">OTP sent to linked mobile ending in <span className="text-blue-400 font-bold">{extractedMobile?.slice(-4)}</span></p>
                                        </div>
                                        <input
                                            type="text" maxLength="6" placeholder="Mobile OTP" value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                            className="w-full bg-slate-950 border border-slate-700/50 rounded-xl py-3 text-center text-xl tracking-widest text-white focus:ring-2 focus:ring-blue-500/50 font-mono"
                                        />
                                        <button type="button" onClick={handleVerifyOtp} className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl">Verify OTP</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {verificationStep === 2 && (
                            <div className="space-y-6 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 animate-fade-in">
                                <div className="text-center">
                                    <Mail className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                                    <h3 className="text-lg font-bold">Email Verification</h3>
                                </div>
                                <div className="space-y-4">
                                    <input
                                        type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500/50"
                                        required
                                    />
                                    {!emailOtpSent ? (
                                        <button type="button" onClick={handleSendEmailOtp} disabled={isEmailOtpLoading} className="w-full py-3 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl font-bold">
                                            {isEmailOtpLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Send Email OTP"}
                                        </button>
                                    ) : (
                                        <div className="space-y-4">
                                            <input type="text" maxLength="6" placeholder="Enter Code" value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} className="w-full bg-slate-950 border border-blue-500/50 rounded-xl py-3 text-center text-xl text-white font-mono" />
                                            <button type="button" onClick={handleVerifyEmailOtp} disabled={isEmailOtpLoading} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20">
                                                {isEmailOtpLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Confirm Email"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {verificationStep === 3 && (
                            <div className="space-y-6 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 animate-fade-in">
                                <div className="text-center">
                                    <Shield className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                                    <h3 className="text-lg font-bold">Biometric Enrollment</h3>
                                </div>
                                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 aspect-video flex items-center justify-center">
                                    {faceCaptured ? (
                                        <div className="relative w-full h-full">
                                            <img src={faceCaptured} alt="Captured" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => { setFaceCaptured(null); startCamera(); }}
                                                className="absolute bottom-4 right-4 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                                            >
                                                <Camera className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : !stream ? (
                                        <button type="button" onClick={startCamera} className="flex flex-col items-center text-slate-500 hover:text-white transition-colors">
                                            <Camera className="w-12 h-12 mb-2" />
                                            <span className="text-sm">Start Biometric Scan</span>
                                        </button>
                                    ) : (
                                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                    )}
                                    {stream && !faceCaptured && <div className="absolute inset-0 border-[3px] border-purple-500/50 rounded-full m-4 pointer-events-none animate-pulse" />}
                                </div>
                                {stream && !faceCaptured && (
                                    <button type="button" onClick={captureFace} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                                        <Fingerprint className="w-5 h-5" />Capture & Verify Biometrics
                                    </button>
                                )}
                            </div>
                        )}

                        {verificationStep === 4 && (
                            <div className="space-y-6 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 animate-fade-in">
                                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    <span className="text-xs font-bold text-emerald-400 uppercase">Identity Verified</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1">EMAIL ADDRESS</label>
                                        <input
                                            type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-emerald-500/50"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1">{mode === 'login' ? 'VERIFY PASSWORD' : 'SET SECURE PASSWORD'}</label>
                                        <input
                                            type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 text-xl"
                                            required
                                        />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? 'Secure Login' : 'Final Registration'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 animate-shake">
                                {error}
                            </div>
                        )}
                    </form>
                </div>

                <div className="mt-8 text-center text-sm border-t border-slate-800/50 pt-6">
                    <p className="text-slate-400">
                        {mode === 'login' ? "Don't have an account?" : "Already verified?"}{' '}
                        <Link to={`/auth?role=${role}&mode=${mode === 'login' ? 'signup' : 'login'}`} className={`text-${themeColor}-400 font-bold hover:underline`}>
                            {mode === 'login' ? 'Signup with Aadhaar' : 'Login here'}
                        </Link>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes scan { 0% { top: 0% } 100% { top: 100% } }
                .animate-scan { position: absolute; width: 100%; height: 2px; animation: scan 2s linear infinite; }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
            `}</style>
        </div>
    );
};

export default AuthPage;
