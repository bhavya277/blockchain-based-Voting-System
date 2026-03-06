import { ShieldCheck, Zap, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div className="flex-grow flex flex-col items-center justify-center relative overflow-hidden px-4">
            {/* Background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

            <div className="max-w-4xl w-full text-center space-y-8 mt-12">
                <div className="inline-flex items-center space-x-2 bg-brand-500/10 text-brand-400 px-4 py-1.5 rounded-full text-sm font-semibold border border-brand-500/20 mb-4 animate-fade-in-up">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                    </span>
                    <span>Web3 Powered Democracy</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6">
                    The future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-emerald-400">voting</span> is here.
                </h1>

                <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                    A truly decentralized, immutable, and transparent election system.
                    Vote with confidence knowing your voice is mathematically secured on the blockchain.
                </p>

                <div className="flex justify-center space-x-6">
                    <Link to="/voter/dashboard" className="btn-primary text-lg px-8 py-4">
                        Cast Your Vote Now
                    </Link>
                    <Link to="/voter/results" className="btn-secondary text-lg px-8 py-4">
                        View Live Results
                    </Link>
                </div>

                {/* Feature grid */}
                <div className="grid md:grid-cols-3 gap-8 mt-24">
                    <FeatureCard
                        icon={<ShieldCheck className="w-8 h-8 text-brand-400" />}
                        title="Sybill Resistant"
                        desc="One wallet, one human, one vote. Mathematically guaranteed."
                    />
                    <FeatureCard
                        icon={<Lock className="w-8 h-8 text-brand-400" />}
                        title="Immutable Records"
                        desc="Votes are etched directly into the Ethereum blockchain permanently."
                    />
                    <FeatureCard
                        icon={<Zap className="w-8 h-8 text-brand-400" />}
                        title="Real-time Auditing"
                        desc="No hidden counting rooms. Anyone can audit the results at any time."
                    />
                </div>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="glass-panel p-8 text-left hover:border-brand-500/30 transition-colors group cursor-default">
            <div className="bg-brand-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-slate-400 leading-relaxed">{desc}</p>
        </div>
    );
}
