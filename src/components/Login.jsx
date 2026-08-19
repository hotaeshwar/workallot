import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogIn, Lock, Mail, AlertCircle, Eye, EyeOff, UserCheck, ShieldCheck, User, KeyRound, CheckCircle, X } from 'lucide-react';
import { showToast } from './Toast';

export default function Login({ onAdminLoginSuccess, onEmployeeLoginSuccess, initialRole = 'employee', isEmployeeOnly = false }) {
  const [roleMode, setRoleMode] = useState(initialRole); // 'employee' or 'admin'
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotNote, setForgotNote] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Detect URL search parameter for separate employee login URL (e.g. ?portal=employee or ?portal=allocator)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const portal = searchParams.get('portal') || searchParams.get('role');
    if (portal === 'allocator' || portal === 'admin') {
      setRoleMode('admin');
    } else if (portal === 'guest' || window.location.pathname.includes('/guest')) {
      setRoleMode('guest');
    } else if (portal === 'employee' || window.location.pathname.includes('/employee')) {
      setRoleMode('employee');
    }
  }, []);

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    setForgotLoading(true);
    setForgotSuccessMsg('');

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'password_requests'), {
        employeeIdentifier: forgotInput.trim(),
        note: forgotNote.trim() || 'Forgot password request',
        status: 'pending',
        requestedAt: new Date().toISOString()
      });
      showToast('Password reset request submitted to your Allocator!', 'success');
      setForgotSuccessMsg('Password reset request submitted successfully! Your Allocator will be notified in their dashboard to reset and share your new password.');
      setForgotInput('');
      setForgotNote('');
    } catch (err) {
      console.error('Password request error:', err);
      showToast('Failed to submit password reset request.', 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (roleMode === 'admin') {
        const userCredential = await signInWithEmailAndPassword(auth, emailOrUsername, password);
        showToast('Signed in successfully as Allocator!', 'success');
        onAdminLoginSuccess(userCredential.user);
      } else {
        // Employee Login check against Firestore employees
        const querySnapshot = await getDocs(collection(db, 'content_reports', 'data', 'employees'));
        const employeesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const inputKey = emailOrUsername.trim().toLowerCase();
        const foundEmp = employeesList.find(emp => 
          emp.hasLogin && 
          (emp.username?.toLowerCase() === inputKey || 
           emp.name?.toLowerCase() === inputKey || 
           emp.email?.toLowerCase() === inputKey ||
           emp.code?.toLowerCase() === inputKey) &&
          emp.password === password
        );

        if (foundEmp) {
          if (roleMode === 'guest' && !foundEmp.isGuest) {
            setError('This credential belongs to a standard employee. Please log in using the Employee Portal.');
            showToast('Standard employee login not allowed here.', 'error');
            setLoading(false);
            return;
          }
          if (roleMode === 'employee' && foundEmp.isGuest) {
            setError('This credential belongs to a Guest account. Please log in using the Guest Console URL.');
            showToast('Guest login not allowed here.', 'error');
            setLoading(false);
            return;
          }
          sessionStorage.setItem('workalloc_employee_session', JSON.stringify(foundEmp));
          showToast(`Welcome back, ${foundEmp.name}!`, 'success');
          onEmployeeLoginSuccess(foundEmp);
        } else {
          setError('Invalid username/email or password. Please contact your Allocator or click "Forgot Password?".');
          showToast('Invalid credentials. Please try again.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid admin credentials. Please try again.');
        showToast('Invalid admin credentials.', 'error');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
        showToast('Invalid email format.', 'error');
      } else {
        setError(err.message || 'An error occurred during login.');
        showToast(err.message || 'Login failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background soft color panels */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full space-y-6 p-8 bg-white border border-slate-200/80 rounded-2xl shadow-xl relative z-10">
        <div>
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow transition duration-200">
              <img src="/LOGO.png" alt="Building India Digital" className="h-16 sm:h-20 w-auto object-contain" />
            </div>
          </div>
          <h2 className="text-center text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            BUILDING INDIA DIGITAL
          </h2>
          <p className="mt-0.5 text-center text-xs font-bold text-indigo-600 uppercase tracking-wider">
            {roleMode === 'guest' ? 'Guest Console Login' : roleMode === 'employee' ? 'Employee Portal Login' : 'Allocator Console Login'}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="emailOrUsername" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                {roleMode === 'admin' ? 'Admin Email Address' : roleMode === 'guest' ? 'Guest Username or Email' : 'Employee Username or Email'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {roleMode === 'admin' ? (
                    <Mail className="h-4 w-4 text-slate-400" />
                  ) : (
                    <User className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <input
                  id="emailOrUsername"
                  name="emailOrUsername"
                  type={roleMode === 'admin' ? 'email' : 'text'}
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  placeholder={roleMode === 'admin' ? 'admin@workallocate.com' : roleMode === 'guest' ? 'e.g. guest_user' : 'e.g. anjali or anjali@company.com'}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {roleMode === 'employee' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotSuccessMsg('');
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                roleMode === 'admin' ? 'Sign In as Allocator' : roleMode === 'guest' ? 'Sign In as Guest' : 'Sign In to Employee Portal'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* FORGOT PASSWORD REQUEST MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowForgotModal(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full relative space-y-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <KeyRound className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Password Reset</h3>
                <p className="text-xs text-slate-500">Send password reset notification to your Allocator</p>
              </div>
            </div>

            {forgotSuccessMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-sm">Request Sent!</span>
                </div>
                <p>{forgotSuccessMsg}</p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Close & Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Your Name, Username, or Employee Code
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    placeholder="E.g., Anjali or BID-101"
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Optional Note / Reason
                  </label>
                  <textarea
                    rows="2"
                    value={forgotNote}
                    onChange={(e) => setForgotNote(e.target.value)}
                    placeholder="E.g., I forgot my password, please reset it."
                    className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs resize-none"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? 'Submitting...' : 'Send Request to Allocator'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
