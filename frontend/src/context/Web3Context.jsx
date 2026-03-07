import { createContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';

export const Web3Context = createContext();

/**
 * NEW Web3Context (Relayer Edition)
 * REPLACED: MetaMask and WalletConnect
 * REASON: High security and seamless UX. The application now uses a secure
 * Backend Relayer to interact with the blockchain, ensuring unique voting
 * without requiring users to manage wallets.
 */
export const Web3Provider = ({ children }) => {
    // We maintain a 'pseudo-address' based on the verified user ID for UI consistency
    const [account, setAccount] = useState(null);
    const [results, setResults] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [stream, setStream] = useState(null); // Live Proctoring Stream
    const [votingEnded, setVotingEnded] = useState(false);

    const startLiveAudit = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });
            setStream(s);
            return s;
        } catch (err) {
            console.error("Camera access denied:", err);
            return null;
        }
    };

    const stopLiveAudit = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    useEffect(() => {
        // Sync account state with verified Firebase user or Mock session
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                setAccount(user.uid.slice(0, 10) + "...");
            } else {
                setAccount(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const connectWallet = () => {
        // No more MetaMask popups! 
        // Verification happens via Aadhaar/Face on AuthPage.
        console.log("Using Secure App Session (MetaMask-less)");
    };

    const logout = async () => {
        try {
            stopLiveAudit(); // Safety: Kill camera on logout
            if (auth) await signOut(auth);
            setAccount(null);
            return true;
        } catch (error) {
            console.error("Logout Error:", error);
            return false;
        }
    };

    const addCandidate = async (name, symbol) => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "admin-token";

            const formData = new FormData();
            formData.append('name', name);
            formData.append('symbol', symbol);

            const res = await fetch('http://localhost:8000/api/candidates/add', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                alert(`Blockchain Success: ${name} added to ledger!`);
                return true;
            } else {
                alert(`Relayer Error: ${data.detail || "Transaction Reverted"}`);
                return false;
            }
        } catch (error) {
            console.error(error);
            alert("Hardware failure communicating with Blockchain Relayer.");
            return false;
        }
    };

    const endVoting = async () => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "admin-token";

            const res = await fetch('http://localhost:8000/api/end-voting', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();
            if (res.ok) {
                alert("The election has been officially CLOSED on the blockchain.");
                setVotingEnded(true);
                return true;
            } else {
                alert(`Error ending vote: ${data.detail}`);
                return false;
            }
        } catch (err) {
            alert("Connection error ending election.");
            return false;
        }
    };

    const startNewElection = async (name) => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "admin-token";

            const formData = new FormData();
            formData.append('name', name);

            const res = await fetch('http://localhost:8000/api/start-new-election', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                alert(`New election "${name}" is now LIVE on the blockchain!`);
                setVotingEnded(false);
                return true;
            } else {
                const data = await res.json();
                alert(`Error starting new election: ${data.detail}`);
                return false;
            }
        } catch (err) {
            alert("Connection error starting new election.");
            return false;
        }
    };

    const castVote = async (candidateId) => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "voter-token";

            const formData = new FormData();
            formData.append('candidate_id', candidateId);

            const res = await fetch('http://localhost:8000/api/vote', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                alert(`Immutability Confirmed: Your vote is now secured on Ethereum!\nTx: ${data.txHash.slice(0, 15)}...`);
                return true;
            } else {
                alert(`Voting Error: ${data.detail || "One human, one vote policy error."}`);
                return false;
            }
        } catch (error) {
            console.error(error);
            alert("Network timeout syncing with Blockchain Ledger.");
            return false;
        }
    };

    const getResults = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('http://localhost:8000/api/results');
            const data = await res.json();
            console.log("Frontend Fetched Results:", data.results);
            if (data.status === "success") {
                setResults(data.results);
                setVotingEnded(data.votingEnded);
                return data.results;
            }
            return [];
        } catch (error) {
            console.error("Sync Error:", error);
            return [];
        } finally {
            setIsSyncing(false);
        }
    };

    const isAdmin = async () => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "admin-token";
            const res = await fetch('http://localhost:8000/api/users/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            return data.role === 'admin';
        } catch (err) {
            return false;
        }
    };

    return (
        <Web3Context.Provider value={{
            account,
            connectWallet,
            castVote,
            getResults,
            results,
            isSyncing,
            isAdmin,
            addCandidate,
            logout,
            stream,
            startLiveAudit,
            stopLiveAudit,
            votingEnded,
            endVoting,
            startNewElection
        }}>
            {children}
        </Web3Context.Provider>
    );
};
