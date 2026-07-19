import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Clock, Calendar, LogOut, Users, FileSpreadsheet, PlusCircle, Menu, X, Briefcase, Megaphone, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Dashboard({ user, activeTab, setActiveTab, children }) {
  const [istTime, setIstTime] = useState('');
  const [istDate, setIstDate] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);

  // Update clock every second in IST
  useEffect(() => {
    const updateTime = () => {
      const timeOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      const dateOptions = {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      };
      
      const timeFormatter = new Intl.DateTimeFormat('en-US', timeOptions);
      const dateFormatter = new Intl.DateTimeFormat('en-US', dateOptions);
      
      const now = new Date();
      setIstTime(timeFormatter.format(now));
      setIstDate(dateFormatter.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const navItems = [
    { id: 'manage', label: 'Employees & Clients', icon: Users },
    { id: 'allocation', label: 'Work Allocation', icon: PlusCircle },
    { id: 'reports', label: 'Reports & Downloads', icon: FileSpreadsheet },
    { id: 'attendance', label: 'Attendance & Timesheets', icon: Clock },
    { id: 'leaves', label: 'Leave Applications', icon: Calendar },
    { id: 'salary', label: 'Salary Slips & Payroll', icon: DollarSign },
    { id: 'announcements', label: 'Broadcasts & Documents', icon: Megaphone },
  ];

  const adminName = user.displayName || user.email.split('@')[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur border-b border-slate-200/80 sticky top-0 z-50 px-4 sm:px-6 lg:px-8 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <img src="/LOGO.png" alt="Building India Digital" className="h-10 sm:h-12 w-auto object-contain shrink-0" />
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900 block leading-tight">BUILDING INDIA DIGITAL</span>
              <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Allocator Admin Console</span>
            </div>
          </div>

          {/* Running Clock and Date (IST) - Responsive styling */}
          <div className="hidden md:flex items-center space-x-6 bg-slate-100/80 border border-slate-200/60 px-4 py-1.5 rounded-xl">
            <div className="flex items-center space-x-2 text-slate-600 text-sm">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>{istDate}</span>
            </div>
            <div className="w-px h-4 bg-slate-200"></div>
            <div className="flex items-center space-x-2 text-indigo-600 font-mono text-sm font-bold tracking-wider">
              <Clock className="h-4 w-4 text-indigo-600 animate-pulse" />
              <span>{istTime} (IST)</span>
            </div>
          </div>

          {/* Admin Identity & Signout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold text-slate-800 capitalize">{adminName}</div>
              <div className="text-xs text-slate-500 font-medium">Role: Admin</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 text-slate-500 rounded-xl transition duration-150 shadow-xs"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* IST Clock bar for Mobile and Tablet */}
        <div className="mt-2.5 flex md:hidden items-center justify-between bg-slate-100/80 border border-slate-200/60 px-3 py-1.5 rounded-lg text-xs">
          <div className="flex items-center space-x-1.5 text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
            <span>{istDate}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-indigo-600 font-mono font-bold">
            <Clock className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
            <span>{istTime} (IST)</span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 relative">
        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute inset-x-0 top-0 bg-white border-b border-slate-200 z-40 p-4 space-y-2 md:hidden transition shadow-xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition ${
                    activeTab === item.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Collapsible Hover-Expand Sidebar for Tablets/Desktop */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-slate-200/80 p-3 shrink-0 shadow-xs group/sidebar transition-all duration-300 ease-in-out z-40 ${
            isSidebarPinned ? 'w-64' : 'w-20 hover:w-64'
          }`}
        >
          {/* Header Toggle */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
            <span className={`text-[10px] font-extrabold text-slate-400 uppercase tracking-wider overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
              isSidebarPinned ? 'opacity-100 w-auto' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'
            }`}>
              {isSidebarPinned ? 'Menu (Pinned)' : 'Navigation'}
            </span>
            <button
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              className="p-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-slate-500 transition cursor-pointer shrink-0 ml-auto"
              title={isSidebarPinned ? 'Unpin Sidebar (Auto-collapse on hover)' : 'Pin Sidebar Open'}
            >
              {isSidebarPinned ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          <div className="space-y-1.5 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-150 overflow-hidden cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={`whitespace-nowrap transition-all duration-200 ${
                    isSidebarPinned ? 'opacity-100 w-auto' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
