import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ManageEntities from './components/ManageEntities';
import WorkAllocation from './components/WorkAllocation';
import ReportExport from './components/ReportExport';
import EmployeeDashboard from './components/EmployeeDashboard';
import AttendanceManagement from './components/AttendanceManagement';
import LeaveManagement from './components/LeaveManagement';
import SalaryManagement from './components/SalaryManagement';
import AnnouncementsManagement from './components/AnnouncementsManagement';
import ToastContainer from './components/Toast';
import SplashScreen from './components/SplashScreen';

export default function App() {
  const [adminUser, setAdminUser] = useState(null);
  const [employeeUser, setEmployeeUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('manage');

  useEffect(() => {
    // Check if employee session exists in sessionStorage
    const savedEmp = sessionStorage.getItem('workalloc_employee_session');
    if (savedEmp) {
      try {
        setEmployeeUser(JSON.parse(savedEmp));
      } catch (err) {
        console.error('Failed to parse employee session:', err);
      }
    }

    // Check Firebase Admin authentication state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAdminUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      setAdminUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleEmployeeLogout = () => {
    sessionStorage.removeItem('workalloc_employee_session');
    setEmployeeUser(null);
  };

  // Detect if current URL is specifically requesting Employee portal
  const searchParams = new URLSearchParams(window.location.search);
  const portalParam = searchParams.get('portal') || searchParams.get('role');
  const isEmployeeURL = window.location.pathname.includes('/employee') || portalParam === 'employee';

  if (showSplash || loading) {
    return (
      <>
        <ToastContainer />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  // 1. Employee Session Active
  if (employeeUser) {
    return (
      <>
        <ToastContainer />
        <EmployeeDashboard 
          employee={employeeUser} 
          onLogout={handleEmployeeLogout} 
        />
      </>
    );
  }

  // 2. Specific Employee URL requested -> Show Employee Login Screen
  if (isEmployeeURL) {
    return (
      <>
        <ToastContainer />
        <Login 
          initialRole="employee"
          isEmployeeOnly={true}
          onAdminLoginSuccess={(user) => setAdminUser(user)}
          onEmployeeLoginSuccess={(emp) => setEmployeeUser(emp)}
        />
      </>
    );
  }

  // 3. Admin View
  if (adminUser) {
    return (
      <>
        <ToastContainer />
        <Dashboard user={adminUser} activeTab={activeTab} setActiveTab={setActiveTab}>
          {activeTab === 'manage' && <ManageEntities />}
          {activeTab === 'allocation' && <WorkAllocation />}
          {activeTab === 'reports' && <ReportExport />}
          {activeTab === 'attendance' && <AttendanceManagement />}
          {activeTab === 'leaves' && <LeaveManagement />}
          {activeTab === 'salary' && <SalaryManagement />}
          {activeTab === 'announcements' && <AnnouncementsManagement />}
        </Dashboard>
      </>
    );
  }

  // 4. Default Allocator Admin Login Screen
  return (
    <>
      <ToastContainer />
      <Login 
        initialRole="admin"
        onAdminLoginSuccess={(user) => setAdminUser(user)}
        onEmployeeLoginSuccess={(emp) => setEmployeeUser(emp)}
      />
    </>
  );
}
