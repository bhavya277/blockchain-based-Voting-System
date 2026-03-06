import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Vote, ShieldCheck, LogOut } from 'lucide-react';
import { useContext } from 'react';
import { Web3Context } from '../context/Web3Context';

export default function Navbar({ portal }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useContext(Web3Context);

    const handleExit = async (e) => {
        e.preventDefault();
        await logout();
        navigate('/');
    };

    // Define separate navigation logic depending on the portal
    const voterLinks = [
        { name: 'Home', path: '/voter' },
        { name: 'Dashboard', path: '/voter/dashboard' },
    ];

    const adminLinks = [
        { name: 'Admin Dashboard', path: '/admin' }
    ];

    const navLinks = portal === 'admin' ? adminLinks : voterLinks;
    const brandIcon = portal === 'admin' ? <ShieldCheck className="w-6 h-6" /> : <Vote className="w-6 h-6" />;
    const rootPath = portal === 'admin' ? '/admin' : '/voter';

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-t-0 border-x-0 rounded-none h-16 px-6 flex items-center justify-between">
            <div className="flex items-center space-x-8">

                {/* Brand Link */}
                <Link to={rootPath} className="flex items-center space-x-2 text-brand-400 hover:text-brand-300 transition-colors">
                    {brandIcon}
                    <span className="font-bold text-xl tracking-tight text-white flex space-x-2">
                        <span>SecureVote</span>
                        <span className="uppercase text-[10px] tracking-widest bg-brand-500/20 text-brand-400 px-2 py-1 rounded-full flex items-center">
                            {portal}
                        </span>
                    </span>
                </Link>

                {/* Dynamic Links */}
                <div className="hidden md:flex space-x-1">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            to={link.path}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === link.path || (location.pathname === '/voter' && link.path === '/voter')
                                ? 'bg-brand-500/10 text-brand-400'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Universal Status Information */}
            <div className="flex items-center space-x-6">
                <div className="text-[10px] uppercase font-bold tracking-[0.2em] bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 rounded-full text-brand-400 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    Ledger Sync: Active
                </div>
                <button
                    onClick={handleExit}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-red-400 transition-all duration-300 group"
                >
                    <div className="p-1.5 rounded-full bg-slate-800 group-hover:bg-red-500/20 transition-all duration-300">
                        <LogOut className="w-4 h-4" />
                    </div>
                    Exit Portal
                </button>
            </div>
        </nav>
    );
}
