import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ManageEntities from './components/ManageEntities';
import WorkAllocation from './components/WorkAllocation';
import ReportExport from './components/ReportExport';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('manage'); // default tab is managing employees/clients

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-400 font-mono text-sm tracking-wider">Syncing Admin Console...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show the Login screen
  if (!user) {
    return <Login onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  // Render content dynamically based on active tab selection in Dashboard
  return (
    <Dashboard user={user} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'manage' && <ManageEntities />}
      {activeTab === 'allocation' && <WorkAllocation />}
      {activeTab === 'reports' && <ReportExport />}
    </Dashboard>
  );
}
