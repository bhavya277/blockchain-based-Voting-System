import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { useContext } from 'react';
import Navbar from './components/Navbar';
import Portal from './pages/Portal';
import Home from './pages/Home';
import VoterDashboard from './pages/VoterDashboard';
import Results from './pages/Results';
import AdminDashboard from './pages/AdminDashboard';
import AuthPage from './pages/AuthPage';
import { Web3Context } from './context/Web3Context';

// Layout for the Voter Side (includes Navigation)
const VoterLayout = () => {
  return (
    <div className="min-h-screen flex flex-col pt-16">
      <Navbar portal="voter" />
      <main className="flex-grow flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};

// Layout for the Admin Side (includes Admin-specific Navigation)
const AdminLayout = () => {
  return (
    <div className="min-h-screen flex flex-col pt-16 bg-slate-950">
      <Navbar portal="admin" />
      <main className="flex-grow flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};

// Persistent Floating Camera Feed
const FloatingCamera = () => {
  const { stream } = useContext(Web3Context);

  if (!stream) return null;

  return (
    <div className="fixed top-20 left-6 z-[100] group">
      <div className="relative">
        <div className="absolute -inset-1 bg-blue-500/20 blur-xl rounded-2xl group-hover:bg-blue-500/40 transition-all opacity-70" />
        <div className="relative w-40 h-52 bg-slate-900 border-2 border-blue-500/50 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          <video
            autoPlay
            playsInline
            muted
            ref={(el) => { if (el) el.srcObject = stream; }}
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 rounded-full border border-blue-500/30 backdrop-blur-md">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_red]" />
            <span className="text-[10px] font-black text-white uppercase tracking-tighter italic">Secured Audit</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <FloatingCamera />
      <Routes>
        {/* Splash Selection Screen (No Navbar) */}
        <Route path="/" element={<Portal />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Voter Portal Branch */}
        <Route path="/voter" element={<VoterLayout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<VoterDashboard />} />
          <Route path="results" element={<Results />} />
        </Route>

        {/* Admin Portal Branch */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          {/* Future admin pages can go here */}
        </Route>

      </Routes>
    </Router>
  );
}

export default App;
