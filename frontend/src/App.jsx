import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Portal from './pages/Portal';
import Home from './pages/Home';
import VoterDashboard from './pages/VoterDashboard';
import Results from './pages/Results';
import AdminDashboard from './pages/AdminDashboard';
import AuthPage from './pages/AuthPage';

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

function App() {
  return (
    <Router>
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
