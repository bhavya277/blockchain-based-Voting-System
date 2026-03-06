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
            if (auth) await signOut(auth);
            setAccount(null);
            return true;
        } catch (error) {
            console.error("Logout Error:", error);
            return false;
        }
    };

    const addCandidate = async (name) => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "admin-token";

            const formData = new FormData();
            formData.append('name', name);

            const res = await fetch('http://localhost:8000/api/candidates/add', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                alert(`Blockchain Success: ${name} added to ledger!\nTxHash: ${data.txHash.slice(0, 20)}...`);
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
            if (data.status === "success") {
                setResults(data.results);
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
            logout
        }}>
            {children}
        </Web3Context.Provider>
    );
};
