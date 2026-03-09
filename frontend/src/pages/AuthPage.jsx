import React, { useState, useRef, useEffect, useContext } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase/firebaseConfig';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Shield, Fingerprint, Mail, Lock, CheckCircle, ArrowRight, Loader2, Upload, Camera, Smartphone, Key, Search } from 'lucide-react';
import { Web3Context } from '../context/Web3Context';

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
    const [userPhotoPreview, setUserPhotoPreview] = useState(null);
    const [userPhotoFile, setUserPhotoFile] = useState(null);

    // Phase Tracking (1: Aadhaar, 2: Email, 3: Face, 4: Credentials)
    const [verificationStep, setVerificationStep] = useState(1);
    const [aadhaarVerified, setAadhaarVerified] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [faceVerified, setFaceVerified] = useState(false);

    // Email OTP states
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailOtp, setEmailOtp] = useState("");
    const [isEmailOtpLoading, setIsEmailOtpLoading] = useState(false);

    // Camera states (Using Global Context)
    const { stream, startLiveAudit, stopLiveAudit } = useContext(Web3Context);
    const [faceCaptured, setFaceCaptured] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef(null);

    // For login mode, we now start with Credentials (Email, Pass, Aadhaar) -> Email OTP -> Biometric
    useEffect(() => {
        stopLiveAudit();
        setShowCamera(false);
        setFaceCaptured(null);
        if (mode === 'login') {
            setAadhaarVerified(false);
            setEmailVerified(false);
            setFaceVerified(false);
            setVerificationStep(4);    // Start at Credentials + Aadhaar
        } else {
            setAadhaarVerified(false);
            setEmailVerified(false);
            setFaceVerified(false);
            setVerificationStep(1);    // Start at Aadhaar Enrollment
        }
    }, [mode]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => stopLiveAudit();
    }, []);

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
            const response = await fetch(`${apiBase}/api/verify-aadhaar`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Verification failed');
            }

            setExtractedMobile(data.linkedMobile);
            setStep(4); // Move to OTP entry (User checks terminal/console)
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
        if (!otp) {
            setError("OTP field is empty.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('aadhaar_number', aadhaar);
            formData.append('otp', otp);

            const response = await fetch(`${apiBase}/api/verify-otp`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Invalid Verification Code.");
            }

            setStep(5);
            setAadhaarVerified(true);
            setVerificationStep(mode === 'login' ? 3 : 2); // Login goes to Biometric, Signup to Email
            setError('');
        } catch (err) {
            console.error("OTP Verification Error:", err);
            setError(err.message || "Invalid Code. Please try again.");
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
                setVerificationStep(3); // Move to Biometric Scan
                setError("");
                // Auto-start camera
                startCamera();
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
        setShowCamera(true);
        const s = await startLiveAudit();
        if (!s) {
            setError("Camera access denied or device not found.");
            setShowCamera(false);
        }
    };

    // Correctly bind stream to video element when it mounts/updates
    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            // Ensure the video plays immediately
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play().catch(e => {});
            };
        }
    }, [stream]);

    const captureFace = async () => {
        // If we have a file selected in signup mode, use that. Otherwise use camera.
        let finalImage = faceCaptured;

        if (mode === 'signup' && userPhotoPreview) {
            finalImage = userPhotoPreview;
        }

        if (!finalImage && (!videoRef.current || !stream)) {
            setError("Please either upload a photo or start the camera.");
            return;
        }

        // If using camera but not captured yet
        if (!finalImage) {
            if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
                setError("Wait for camera to initialize...");
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            finalImage = canvas.toDataURL('image/jpeg', 0.8);
            setFaceCaptured(finalImage);
        }

        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('face_image', finalImage);
            formData.append('uid', email);

            const endpoint = mode === 'signup' ? '/api/biometric/register' : '/api/verify-face';
            const res = await fetch(`${apiBase}${endpoint}`, { method: 'POST', body: formData });

            const data = await res.json();
            if (res.ok) {
                setFaceVerified(true);
                if (mode === 'login') {
                    setError("Biometrics Confirmed. Redirecting to Secure Dashboard...");
                    setTimeout(() => {
                        navigate(role === 'admin' ? '/admin' : '/voter/dashboard');
                    }, 1000);
                } else {
                    setVerificationStep(4);
                }
                stopLiveAudit();
            } else {
                throw new Error(data.detail || "Biometric validation failed. Please ensure your face is clearly visible.");
            }
        } catch (err) {
            setError(err.message + " Ensure you registered with this email.");
            setFaceCaptured(null);
            setShowCamera(false); // Reset to allow retry
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        if (mode === 'signup' && (!aadhaarVerified || !emailVerified || !faceVerified)) {
            setError('Please complete Aadhaar, Email and Face verification first.');
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
                if (!aadhaarVerified || !emailVerified || !faceVerified) {
                    setError('Please complete all verification steps first.');
                    setLoading(false);
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const token = await user.getIdToken();

                const regResponse = await fetch(`${apiBase}/api/voters/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        email, role, aadhaar, // Full Aadhaar sent for identity linking
                        voter_id: voterId, mobile: extractedMobile, wallet_address: "not-connected"
                    })
                });

                if (!regResponse.ok) throw new Error('Backend sync failed');
                navigate(role === 'admin' ? '/admin' : '/voter/dashboard');
            } else {
                // LOGIN FLOW: Step 1 (Verify Credentials + Aadhaar Number)
                if (!aadhaar || aadhaar.length !== 12) {
                    throw new Error("Please enter your 12-digit Aadhaar number for verification.");
                }

                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const token = await user.getIdToken();

                // Check profile for Aadhaar match
                const profileRes = await fetch(`${apiBase}/api/users/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!profileRes.ok) throw new Error('Could not retrieve account profile.');
                const profile = await profileRes.json();

                // For security, we compare the entered Aadhaar with the masked or full one on file
                // Note: profile.aadhaar is usually masked like *******1234
                const enteredLast4 = aadhaar.slice(-4);
                const storedLast4 = profile.aadhaar.slice(-4);

                if (enteredLast4 !== storedLast4) {
                    throw new Error("Aadhaar Number mismatch. Please enter the number linked to this account.");
                }

                console.log("Credentials & Aadhaar Verified, moving to Email OTP");
                setAadhaarVerified(true);
                setVerificationStep(2); // Move to Email OTP
                handleSendEmailOtp();    // Auto-trigger OTP
                setError("");
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

                                        {mode === 'signup' && (
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
                                        )}

                                        <button type="button" onClick={() => simulateScanning()} disabled={verifying} className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group">
                                            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 group-hover:scale-110" />Start Identity Verification</>}
                                        </button>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-4 py-4 text-center">
                                        <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto" />
                                        <p className="text-sm font-mono text-blue-400 animate-pulse">SCANNING BIOMETRICS...</p>
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
                                    {mode === 'signup' && <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Upload reference photo OR use camera</p>}
                                </div>

                                {mode === 'signup' && !stream && !faceCaptured && (
                                    <div className="flex flex-col gap-4">
                                        <div
                                            onClick={() => document.getElementById('user-photo-upload').click()}
                                            className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-purple-500/50 rounded-2xl p-6 text-center transition-all bg-slate-900/50"
                                        >
                                            <input
                                                id="user-photo-upload"
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const f = e.target.files[0];
                                                    if (f) {
                                                        setUserPhotoFile(f);
                                                        const reader = new FileReader();
                                                        reader.onload = (e) => setUserPhotoPreview(e.target.result);
                                                        reader.readAsDataURL(f);
                                                    }
                                                }}
                                            />
                                            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                            <p className="text-sm font-bold text-slate-300">Choose Master Photo</p>
                                            {userPhotoPreview && <p className="text-xs text-emerald-400 mt-1">✓ Photo selected from file</p>}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-grow h-px bg-slate-800"></div>
                                            <span className="text-[10px] text-slate-600 font-bold uppercase">OR</span>
                                            <div className="flex-grow h-px bg-slate-800"></div>
                                        </div>
                                    </div>
                                )}

                                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 aspect-video flex items-center justify-center">
                                    {userPhotoPreview && mode === 'signup' && !faceCaptured ? (
                                        <div className="relative w-full h-full">
                                            <img src={userPhotoPreview} alt="Reference" className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => { setUserPhotoPreview(null); setUserPhotoFile(null); }} className="absolute top-2 right-2 bg-red-500/80 text-white p-1.5 rounded-full hover:bg-red-600">
                                                <Lock className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : faceCaptured ? (
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
                                    ) : !showCamera ? (
                                        <button type="button" onClick={startCamera} className="flex flex-col items-center text-slate-500 hover:text-white transition-colors">
                                            <Camera className="w-12 h-12 mb-2" />
                                            <span className="text-sm">Start Biometric Scan</span>
                                        </button>
                                    ) : (
                                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                    )}
                                    {stream && !faceCaptured && <div className="absolute inset-0 border-[3px] border-purple-500/50 rounded-full m-4 pointer-events-none animate-pulse" />}
                                </div>

                                {((stream && !faceCaptured) || (userPhotoPreview && mode === 'signup')) && (
                                    <button type="button" onClick={captureFace} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                                        <Fingerprint className="w-5 h-5" />
                                        {mode === 'signup' ? 'Finalize Biometric Enrollment' : 'Capture & Verify Biometrics'}
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

                                    {mode === 'login' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 ml-1">AADHAAR NUMBER</label>
                                            <input
                                                type="text" maxLength="12" placeholder="12 Digit Number" value={aadhaar}
                                                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 font-mono"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 ml-1">{mode === 'login' ? 'VERIFY PASSWORD' : 'SET SECURE PASSWORD'}</label>
                                        <input
                                            type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 text-xl"
                                            required
                                        />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? 'Continue to Email OTP' : 'Final Registration'}
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
                @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out; }
            `}</style>
        </div>
    );
};

export default AuthPage;
