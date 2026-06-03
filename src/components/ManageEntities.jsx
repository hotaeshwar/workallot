import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Plus, UserPlus, FolderPlus, Trash2, User, Briefcase, ShieldAlert, Layers } from 'lucide-react';

const PALETTE = [
  { name: 'Rose', hex: '#FFE4E6', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { name: 'Amber', hex: '#FEF3C7', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { name: 'Emerald', hex: '#D1FAE5', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { name: 'Sky', hex: '#E0F2FE', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  { name: 'Indigo', hex: '#E0E7FF', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { name: 'Violet', hex: '#F5F3FF', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { name: 'Teal', hex: '#CCFBF1', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { name: 'Orange', hex: '#FFEDD5', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
];

export default function ManageEntities() {
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [postTypes, setPostTypes] = useState([]);

  // Form states
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empColor, setEmpColor] = useState(PALETTE[0].hex);
  
  const [clientName, setClientName] = useState('');
  const [clientIndustry, setClientIndustry] = useState('');

  const [postTypeName, setPostTypeName] = useState('');

  const [loadingEmp, setLoadingEmp] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);
  const [loadingPostType, setLoadingPostType] = useState(false);
  const [error, setError] = useState('');

  // Fetch employees, clients, and post types using real-time listeners
  useEffect(() => {
    const qEmp = query(collection(db, 'content_reports', 'data', 'employees'), orderBy('name', 'asc'));
    const unsubscribeEmp = onSnapshot(qEmp, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(emps);
    });

    const qClient = query(collection(db, 'content_reports', 'data', 'clients'), orderBy('name', 'asc'));
    const unsubscribeClient = onSnapshot(qClient, (snapshot) => {
      const cls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(cls);
    });

    const qPost = query(collection(db, 'content_reports', 'data', 'post_types'), orderBy('name', 'asc'));
    let isSeeding = false;
    const unsubscribePost = onSnapshot(qPost, async (snapshot) => {
      if (snapshot.empty && !isSeeding) {
        isSeeding = true;
        const defaults = [
          { name: 'Story', value: 'story' },
          { name: 'Reel', value: 'reel' },
          { name: 'Post', value: 'post' },
          { name: 'PDF', value: 'pdf' },
          { name: 'Banner/Flyer', value: 'banner/flyer' },
          { name: 'Printable', value: 'printable' },
          { name: 'Logo/Vector', value: 'logo/vector' },
        ];
        try {
          for (const item of defaults) {
            await addDoc(collection(db, 'content_reports', 'data', 'post_types'), {
              ...item,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error('Failed to seed default post types:', err);
        } finally {
          isSeeding = false;
        }
      } else {
        const pts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPostTypes(pts);
      }
    });

    return () => {
      unsubscribeEmp();
      unsubscribeClient();
      unsubscribePost();
    };
  }, []);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empName.trim() || !empRole.trim()) return;
    setLoadingEmp(true);
    setError('');

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'employees'), {
        name: empName.trim(),
        role: empRole.trim(),
        color: empColor,
        createdAt: new Date().toISOString(),
      });
      setEmpName('');
      setEmpRole('');
      setEmpColor(PALETTE[Math.floor(Math.random() * PALETTE.length)].hex);
    } catch (err) {
      console.error(err);
      setError('Failed to add employee. Please try again.');
    } finally {
      setLoadingEmp(false);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    setLoadingClient(true);
    setError('');

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'clients'), {
        name: clientName.trim(),
        industry: clientIndustry.trim() || 'General',
        createdAt: new Date().toISOString(),
      });
      setClientName('');
      setClientIndustry('');
    } catch (err) {
      console.error(err);
      setError('Failed to add client. Please try again.');
    } finally {
      setLoadingClient(false);
    }
  };

  const handleAddPostType = async (e) => {
    e.preventDefault();
    if (!postTypeName.trim()) return;
    setLoadingPostType(true);
    setError('');

    const cleanName = postTypeName.trim();
    const cleanValue = cleanName.toLowerCase();

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'post_types'), {
        name: cleanName,
        value: cleanValue,
        createdAt: new Date().toISOString(),
      });
      setPostTypeName('');
    } catch (err) {
      console.error(err);
      setError('Failed to add post type. Please try again.');
    } finally {
      setLoadingPostType(false);
    }
  };

  const handleDeleteEmployee = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete employee "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'employees', id));
      } catch (err) {
        console.error(err);
        setError('Failed to delete employee.');
      }
    }
  };

  const handleDeleteClient = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete client "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'clients', id));
      } catch (err) {
        console.error(err);
        setError('Failed to delete client.');
      }
    }
  };

  const handleDeletePostType = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete post type "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'post_types', id));
      } catch (err) {
        console.error(err);
        setError('Failed to delete post type.');
      }
    }
  };

  // Find palette helper to apply color themes to UI cards
  const getTheme = (hex) => {
    return PALETTE.find(p => p.hex === hex) || PALETTE[0];
  };

  const getPostTheme = (value) => {
    const val = (value || '').toLowerCase();
    if (val === 'story') return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    if (val === 'reel') return { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' };
    if (val === 'post') return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    if (val === 'pdf') return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    if (val.includes('banner') || val.includes('flyer')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    if (val === 'printable') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    if (val.includes('logo') || val.includes('vector')) return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Manage Infrastructure
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Create and view employees and clients. Information is synchronized dynamically to Firestore.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-800 text-sm">
          <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid Layout: Stacks on mobile/tablet, 3 Columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* EMPLOYEES PANEL */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 flex flex-col shadow-sm">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <UserPlus className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">Add Employee</h2>
              <p className="text-slate-500 text-xs mt-1">Add new staff members to allocate work to.</p>
            </div>
          </div>

          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Employee Full Name
              </label>
              <input
                type="text"
                required
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                placeholder="E.g., Anjali Sharma"
                className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Designation / Role
              </label>
              <input
                type="text"
                required
                value={empRole}
                onChange={(e) => setEmpRole(e.target.value)}
                placeholder="E.g., Social Media Specialist"
                className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Premium Color Picker Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Assigned Theme Color (for Excel & UI highlight)
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {PALETTE.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setEmpColor(color.hex)}
                    className={`h-9 w-full rounded-xl border transition-all ${
                      empColor === color.hex 
                        ? 'ring-2 ring-indigo-500 scale-105 border-indigo-600' 
                        : 'border-slate-200 hover:scale-105 shadow-xs'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingEmp}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loadingEmp ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Create Employee</span>
                </>
              )}
            </button>
          </form>

          {/* List Section */}
          <div className="flex-1 flex flex-col space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Active Employees ({employees.length})</span>
            </h3>
            
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {employees.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                  No employees created yet.
                </div>
              ) : (
                employees.map((emp) => {
                  const theme = getTheme(emp.color);
                  return (
                    <div
                      key={emp.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border ${theme.bg} ${theme.border} transition duration-150`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-white border border-slate-100 shadow-xs">
                          <User className={`h-4 w-4 ${theme.text}`} />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-slate-900 block leading-snug">{emp.name}</span>
                          <span className="text-xs text-slate-500">{emp.role}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                        className="p-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 text-slate-400 rounded-lg transition duration-150 shadow-xs"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* CLIENTS PANEL */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 flex flex-col shadow-sm">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <FolderPlus className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">Add Client</h2>
              <p className="text-slate-500 text-xs mt-1">Configure client records for work tracking.</p>
            </div>
          </div>

          <form onSubmit={handleAddClient} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Client Brand Name
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="E.g., Nike India"
                className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Industry / Vertical (Optional)
              </label>
              <input
                type="text"
                value={clientIndustry}
                onChange={(e) => setClientIndustry(e.target.value)}
                placeholder="E.g., Apparel & Retail"
                className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loadingClient}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loadingClient ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Create Client</span>
                </>
              )}
            </button>
          </form>

          {/* List Section */}
          <div className="flex-1 flex flex-col space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Active Clients ({clients.length})</span>
            </h3>
            
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {clients.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                  No clients created yet.
                </div>
              ) : (
                clients.map((cl) => (
                  <div
                    key={cl.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 transition duration-150"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                        <Briefcase className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-slate-900 block leading-snug">{cl.name}</span>
                        <span className="text-xs text-indigo-600 font-semibold">{cl.industry}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClient(cl.id, cl.name)}
                      className="p-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 text-slate-400 rounded-lg transition duration-150 shadow-xs"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* POST TYPES PANEL */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 flex flex-col shadow-sm">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Layers className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">Add Post Type</h2>
              <p className="text-slate-500 text-xs mt-1">Configure post types for work assignment.</p>
            </div>
          </div>

          <form onSubmit={handleAddPostType} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Post Type Name
              </label>
              <input
                type="text"
                required
                value={postTypeName}
                onChange={(e) => setPostTypeName(e.target.value)}
                placeholder="E.g., PDF or Banner/Flyer"
                className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loadingPostType}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loadingPostType ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Create Post Type</span>
                </>
              )}
            </button>
          </form>

          {/* List Section */}
          <div className="flex-1 flex flex-col space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Active Post Types ({postTypes.length})</span>
            </h3>
            
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {postTypes.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                  No post types created yet.
                </div>
              ) : (
                postTypes.map((pt) => {
                  const ptTheme = getPostTheme(pt.value);
                  return (
                    <div
                      key={pt.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border ${ptTheme.bg} ${ptTheme.border} transition duration-150`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-white border border-slate-100 shadow-xs">
                          <Layers className={`h-4 w-4 ${ptTheme.text}`} />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-slate-900 block leading-snug">{pt.name}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeletePostType(pt.id, pt.name)}
                        className="p-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 text-slate-400 rounded-lg transition duration-150 shadow-xs"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

