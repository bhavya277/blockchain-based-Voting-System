import { Shield, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Portal() {
    return (
        <div className="flex-grow flex flex-col items-center justify-center relative overflow-hidden px-4 min-h-screen pb-20">
            {/* Background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="text-center mb-16 animate-fade-in-up">
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
                    Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-emerald-400">SecureVote</span>
                </h1>
                <p className="text-slate-400 text-lg max-w-xl mx-auto">
                    Please select your portal to continue interacting with the decentralized ledger.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
                {/* Admin Portal Card */}
                <Link
                    to="/auth?role=admin"
                    className="glass-panel p-10 flex flex-col items-center justify-center text-center group hover:-translate-y-2 hover:border-brand-500/50 hover:shadow-brand-500/20 transition-all cursor-pointer"
                >
                    <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 group-hover:bg-brand-500/20 transition-colors">
                        <Shield className="w-10 h-10 text-slate-400 group-hover:text-brand-400 transition-colors" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Admin Portal</h2>
                    <p className="text-slate-400">
                        Manage election parameters, verify candidates, and deploy to the blockchain.
                    </p>
                </Link>

                {/* Voter Portal Card */}
                <Link
                    to="/auth?role=voter"
                    className="glass-panel p-10 flex flex-col items-center justify-center text-center group hover:-translate-y-2 hover:border-blue-500/50 hover:shadow-blue-500/20 transition-all cursor-pointer"
                >
                    <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                        <Users className="w-10 h-10 text-slate-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Voter Portal</h2>
                    <p className="text-slate-400">
                        Authenticate your identity and cast your immutable vote on-chain.
                    </p>
                </Link>
            </div>

            {/* Public Results Link */}
            <div className="mt-16 text-center animate-fade-in">
                <p className="text-slate-500 mb-4">Just looking for the outcome?</p>
                <Link to="/voter/results" className="text-slate-300 hover:text-white underline decoration-slate-600 underline-offset-4 transition-colors">
                    View Public Results Dashboard
                </Link>
            </div>
        </div>
    );
}
