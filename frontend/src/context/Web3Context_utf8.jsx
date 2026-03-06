import { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createWeb3Modal, defaultConfig, useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider, useDisconnect } from '@web3modal/ethers/react';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';

import contractABI from '../utils/contractABI.json';
import contractAddressData from '../utils/contractAddress.json';

const abi = contractABI;
const contractAddress = contractAddressData.address;

// 1. Get projectId at https://cloud.walletconnect.com
const projectId = 'dce178099c1b1193f618d8c8f00051dc'; // Replace with a real project ID from WalletConnect Cloud

// 2. Set chains
const mainnet = {
    chainId: 1,
    name: 'Ethereum',
    currency: 'ETH',
    explorerUrl: 'https://etherscan.io',
    rpcUrl: 'https://cloudflare-eth.com'
};

const sepolia = {
    chainId: 11155111,
    name: 'Sepolia',
    currency: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: 'https://rpc.ankr.com/eth_sepolia'
};

const localhost = {
    chainId: 31337,
    name: 'Hardhat Local',
    currency: 'ETH',
    explorerUrl: '',
    rpcUrl: 'http://127.0.0.1:8545'
};

// 3. Create a metadata object
const metadata = {
    name: 'Decentralized Voting System',
    description: 'Hackathon-ready MVP for immutable voting',
    url: 'http://localhost:5173', // origin must match your domain & subdomain
    icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// 4. Create Ethers config
const ethersConfig = defaultConfig({
    metadata,
    enableEthersDeterminstic: false,
    enableEmail: true, // Optional - enable email wallet
    enableSmartAccounts: true // Optional - enable smart accounts
});

// 5. Create modal
createWeb3Modal({
    ethersConfig,
    chains: [mainnet, sepolia, localhost],
    projectId,
    enableAnalytics: true
});

export const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
    const { address, chainId, isConnected } = useWeb3ModalAccount();
    const { walletProvider } = useWeb3ModalProvider();
    const { open } = useWeb3Modal();
    const { disconnect } = useDisconnect();

    const [contract, setContract] = useState(null);

    const connectWallet = () => {
        if (projectId === 'YOUR_PROJECT_ID') {
            alert("Configuration Error: You must provide a real Project ID from https://cloud.walletconnect.com in Web3Context.jsx to use WalletConnect.");
        }
        open();
    };

    useEffect(() => {
        if (isConnected && walletProvider) {
            setupContract();
        } else {
            setContract(null);
        }
    }, [isConnected, walletProvider, chainId]);

    const logout = async () => {
        try {
            // 1. Disconnect Blockchain Wallet
            if (isConnected) {
                await disconnect();
            }

            // 2. Logout Firebase if initialized
            if (auth) {
                await signOut(auth);
            }

            console.log("Logged out from both Firebase and Wallet.");
            return true;
        } catch (error) {
            console.error("Logout Error:", error);
            return false;
        }
    };

    const setupContract = async () => {
        try {
            const ethersProvider = new ethers.BrowserProvider(walletProvider);
            const signer = await ethersProvider.getSigner();
            const votingContract = new ethers.Contract(contractAddress, abi, signer);
            setContract(votingContract);
        } catch (error) {
            console.error("Failed to setup contract:", error);
        }
    };

    const isAdminCheck = async () => {
        try {
            let token = await auth.currentUser?.getIdToken();
            if (!token) token = "admin-token"; // Test Bypass

            const res = await fetch('http://localhost:8000/api/users/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            return data.role === 'admin';
        } catch (err) {
            return false;
        }
    };

    const addCandidate = async (name) => {
        if (!isConnected || !contract || !address) {
            alert("No wallet connected!");
            open();
            return false;
        }

        try {
            // VERIFY WITH BACKEND BEFORE TRANSACTION
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('http://localhost:8000/api/users/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const profile = await res.json();

            if (profile.role !== 'admin') {
                alert("Access Denied: You are not an admin in the database.");
                return false;
            }

            if (profile.walletAddress.toLowerCase() !== address.toLowerCase()) {
                alert(`Wallet Mismatch! Please use your registered admin wallet: ${profile.walletAddress}`);
                return false;
            }

            const tx = await contract.addCandidate(name);
            await tx.wait();
            alert(`${name} added successfully!`);
            return true;
        } catch (error) {
            console.error(error);
            alert("Transaction Failed. Check if you are the contract owner or have enough gas.");
            return false;
        }
    };

    const castVote = async (candidateId) => {
        if (!isConnected || !contract || !address) {
            alert("No wallet connected!");
            open();
            return false;
        }
        try {
            // VERIFY WITH BACKEND BEFORE TRANSACTION
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('http://localhost:8000/api/users/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const profile = await res.json();

            if (profile.walletAddress.toLowerCase() !== address.toLowerCase()) {
                alert(`Wallet Mismatch! Please use your registered wallet: ${profile.walletAddress}`);
                return false;
            }

            const tx = await contract.vote(candidateId);
            await tx.wait();
            alert("Vote Casted Immutably!");
            return true;
        } catch (error) {
            console.error(error);
            alert("Transaction Failed. Have you already voted?");
            return false;
        }
    };

    const getResults = async () => {
        if (!contract) return [];
        try {
            const results = await contract.getResults();
            return results.map(c => ({
                id: Number(c.id),
                name: c.name,
                voteCount: Number(c.voteCount)
            }));
        } catch (error) {
            console.error("Failed to fetch results", error);
            return [];
        }
    };

    return (
        <Web3Context.Provider value={{
            account: address,
            connectWallet,
            contract,
            castVote,
            getResults,
            isConnecting: false,
            isAdmin: isAdminCheck,
            addCandidate,
            logout
        }}>
            {children}
        </Web3Context.Provider>
    );
};
