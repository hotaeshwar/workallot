import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy 
} from 'firebase/firestore';
import { 
  PlusCircle, Edit3, Trash2, Archive, Search, ExternalLink, 
  CheckCircle, AlertCircle, RefreshCw, X, Save, Plus, Trash, Link2 
} from 'lucide-react';

export default function WorkAllocation() {
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [allocations, setAllocations] = useState([]);
  
  // Form states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [workType, setWorkType] = useState('story');
  const [urls, setUrls] = useState(['']);
  const [driveUrl, setDriveUrl] = useState('');
  const [remark, setRemark] = useState('');
  const [allocationDate, setAllocationDate] = useState(
    new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
  );

  // Table states
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state
  const [editingAlloc, setEditingAlloc] = useState(null);
  const [editEmpId, setEditEmpId] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [editWorkType, setEditWorkType] = useState('');
  const [editUrls, setEditUrls] = useState(['']);
  const [editDriveUrl, setEditDriveUrl] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [editDate, setEditDate] = useState('');

  // Listeners for dropdowns and allocations
  useEffect(() => {
    // 1. Fetch Employees
    const qEmp = query(collection(db, 'content_reports', 'data', 'employees'), orderBy('name', 'asc'));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Fetch Clients
    const qClient = query(collection(db, 'content_reports', 'data', 'clients'), orderBy('name', 'asc'));
    const unsubClient = onSnapshot(qClient, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Fetch Active (unarchived) Allocations
    const qAlloc = query(
      collection(db, 'content_reports', 'data', 'allocations'), 
      where('archived', '==', false)
    );
    const unsubAlloc = onSnapshot(qAlloc, (snapshot) => {
      const alls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort allocations locally by date desc then createdAt desc
      alls.sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      setAllocations(alls);
    });

    return () => {
      unsubEmp();
      unsubClient();
      unsubAlloc();
    };
  }, []);

  const handleCreateAllocation = async (e) => {
    e.preventDefault();
    if (!selectedEmpId || !selectedClientId) {
      setError('Please select both an employee and a client.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    const emp = employees.find(e => e.id === selectedEmpId);
    const client = clients.find(c => c.id === selectedClientId);

    // Filter out blank URLs
    const finalUrls = urls.map(u => u.trim()).filter(u => u !== '');

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'allocations'), {
        employeeId: selectedEmpId,
        employeeName: emp.name,
        employeeColor: emp.color || '#94a3b8',
        clientId: selectedClientId,
        clientName: client.name,
        type: workType,
        urls: finalUrls,
        driveUrl: driveUrl.trim(),
        remark: remark.trim(),
        date: allocationDate,
        status: 'allocated',
        archived: false,
        createdAt: new Date().toISOString(),
      });

      setSuccess('Work entry allocated successfully.');
      setUrls(['']);
      setDriveUrl('');
      setRemark('');
      // Auto dismiss success after 3s
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to save allocation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (alloc) => {
    setEditingAlloc(alloc);
    setEditEmpId(alloc.employeeId);
    setEditClientId(alloc.clientId);
    setEditWorkType(alloc.type);
    
    // Support backward compatibility if older records only have a single 'url' string
    const existingUrls = alloc.urls || (alloc.url ? [alloc.url] : ['']);
    setEditUrls(existingUrls.length > 0 ? existingUrls : ['']);
    setEditDriveUrl(alloc.driveUrl || '');
    setEditRemark(alloc.remark || '');
    setEditDate(alloc.date);
  };

  const handleUpdateAllocation = async (e) => {
    e.preventDefault();
    if (!editEmpId || !editClientId) return;
    setLoading(true);

    const emp = employees.find(e => e.id === editEmpId);
    const client = clients.find(c => c.id === editClientId);

    const finalUrls = editUrls.map(u => u.trim()).filter(u => u !== '');

    try {
      await updateDoc(doc(db, 'content_reports', 'data', 'allocations', editingAlloc.id), {
        employeeId: editEmpId,
        employeeName: emp.name,
        employeeColor: emp.color || '#94a3b8',
        clientId: editClientId,
        clientName: client.name,
        type: editWorkType,
        urls: finalUrls,
        driveUrl: editDriveUrl.trim(),
        remark: editRemark.trim(),
        date: editDate,
      });

      setSuccess('Work allocation updated successfully.');
      setEditingAlloc(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to update allocation.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllocation = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this allocation entry?')) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'allocations', id));
        setSuccess('Entry deleted permanently.');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        console.error(err);
        setError('Failed to delete allocation.');
      }
    }
  };

  const handleArchiveAllocation = async (id) => {
    if (window.confirm('Archive this allocation? It will be removed from this active table but remains accessible in downloadable sheets.')) {
      try {
        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', id), { archived: true });
        setSuccess('Entry archived successfully.');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        console.error(err);
        setError('Failed to archive allocation.');
      }
    }
  };

  // Filter allocations by search term (searches employee, client, type, remark)
  const filteredAllocations = allocations.filter(alloc => {
    const term = searchTerm.toLowerCase();
    return (
      alloc.employeeName.toLowerCase().includes(term) ||
      alloc.clientName.toLowerCase().includes(term) ||
      alloc.type.toLowerCase().includes(term) ||
      alloc.remark.toLowerCase().includes(term) ||
      alloc.date.includes(term)
    );
  });

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Work Allocation Panel
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Assign daily posts, reels, or stories to active employees for respective clients.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-800 text-sm animate-fade-in">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start space-x-3 text-emerald-800 text-sm animate-fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid: Form in left panel/top, Data list on right/bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CREATE ALLOCATION FORM */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 h-fit space-y-6 shadow-sm">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <PlusCircle className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">New Allocation</h2>
              <p className="text-slate-500 text-xs mt-1">Allocate work schedules here.</p>
            </div>
          </div>

          {employees.length === 0 || clients.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
              Please create at least one employee and one client in the <span className="font-semibold underline">Manage</span> tab to allocate work.
            </div>
          ) : (
            <form onSubmit={handleCreateAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Select Employee
                </label>
                <select
                  required
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Select Client
                </label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map(cl => (
                    <option key={cl.id} value={cl.id}>{cl.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Post Type
                  </label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
                  >
                    <option value="story">Story</option>
                    <option value="reel">Reel</option>
                    <option value="post">Post</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    required
                    value={allocationDate}
                    onChange={(e) => setAllocationDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Reference URLs (Optional)</span>
                  <button
                    type="button"
                    onClick={() => setUrls([...urls, ''])}
                    className="text-xs text-indigo-600 hover:text-indigo-850 font-bold flex items-center space-x-0.5 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add URL</span>
                  </button>
                </label>
                <div className="space-y-2">
                  {urls.map((u, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={u}
                        onChange={(e) => {
                          const newUrls = [...urls];
                          newUrls[i] = e.target.value;
                          setUrls(newUrls);
                        }}
                        placeholder="https://instagram.com/p/..."
                        className="block flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      {urls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setUrls(urls.filter((_, idx) => idx !== i))}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition cursor-pointer"
                          title="Remove URL"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Google Drive Link (Optional)
                </label>
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Remark / Instructions
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="E.g., Publish at 6:00 PM with sports hashtags"
                  rows="3"
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <PlusCircle className="h-4.5 w-4.5" />
                    <span>Allocate Work</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* ACTIVE WORK ALLOCATIONS TABLE */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">Active Work Allocations</h2>
              <p className="text-slate-500 text-xs mt-1">Real-time table of schedules active for employees.</p>
            </div>
            
            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search allocations..."
                className="block w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50/50">
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Scheduled Date</th>
                  <th className="p-3.5 max-w-xs">Remarks & Link</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredAllocations.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-400">
                      No active allocations found.
                    </td>
                  </tr>
                ) : (
                  filteredAllocations.map((alloc) => (
                    <tr 
                      key={alloc.id} 
                      className="hover:bg-slate-50/50 transition duration-150"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <span 
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                            style={{ backgroundColor: alloc.employeeColor }}
                          />
                          <span className="font-semibold text-slate-800">{alloc.employeeName}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">
                        {alloc.clientName}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${
                          alloc.type === 'story' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          alloc.type === 'reel' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                          'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}>
                          {alloc.type}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 font-mono text-xs font-semibold">
                        {new Date(alloc.date).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </td>
                      <td className="p-3.5 text-xs text-slate-500 max-w-xs">
                        <div className="space-y-1">
                          {/* Render Google Drive Link if exists */}
                          {alloc.driveUrl && (
                            <a 
                              href={alloc.driveUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-emerald-700 hover:text-emerald-800 hover:underline font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mr-2 mb-1"
                            >
                              <span>Drive Link</span>
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          )}

                          {/* Render Reference URLs */}
                          {(() => {
                            const rowUrls = alloc.urls || (alloc.url ? [alloc.url] : []);
                            if (rowUrls.length === 0) {
                              return !alloc.driveUrl && <span className="text-slate-400 italic">No links provided</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {rowUrls.map((lnk, idx) => (
                                  <a 
                                    key={idx}
                                    href={lnk} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-indigo-700 hover:text-indigo-800 hover:underline font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                                  >
                                    <span>Ref {rowUrls.length > 1 ? idx + 1 : ''}</span>
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </a>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="truncate text-slate-600 mt-1" title={alloc.remark}>{alloc.remark || <span className="text-slate-400 italic">No remarks</span>}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenEdit(alloc)}
                            className="p-1.5 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-lg transition shadow-xs"
                            title="Edit Entry"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchiveAllocation(alloc.id)}
                            className="p-1.5 bg-white hover:bg-slate-50 text-amber-600 border border-slate-200 rounded-lg transition shadow-xs"
                            title="Archive Entry"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAllocation(alloc.id)}
                            className="p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg transition shadow-xs"
                            title="Delete Permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* EDIT ALLOCATION MODAL */}
      {editingAlloc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 max-w-lg w-full rounded-2xl shadow-xl p-6 space-y-6 animate-zoom-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <Edit3 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Edit Allocation Entry</h3>
              </div>
              <button
                onClick={() => setEditingAlloc(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Employee
                </label>
                <select
                  required
                  value={editEmpId}
                  onChange={(e) => setEditEmpId(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Client
                </label>
                <select
                  required
                  value={editClientId}
                  onChange={(e) => setEditClientId(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {clients.map(cl => (
                    <option key={cl.id} value={cl.id}>{cl.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Post Type
                  </label>
                  <select
                    value={editWorkType}
                    onChange={(e) => setEditWorkType(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
                  >
                    <option value="story">Story</option>
                    <option value="reel">Reel</option>
                    <option value="post">Post</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

               <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Reference URLs (Optional)</span>
                  <button
                    type="button"
                    onClick={() => setEditUrls([...editUrls, ''])}
                    className="text-xs text-indigo-600 hover:text-indigo-850 font-bold flex items-center space-x-0.5 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add URL</span>
                  </button>
                </label>
                <div className="space-y-2">
                  {editUrls.map((u, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={u}
                        onChange={(e) => {
                          const newUrls = [...editUrls];
                          newUrls[i] = e.target.value;
                          setEditUrls(newUrls);
                        }}
                        placeholder="https://instagram.com/p/..."
                        className="block flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      {editUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditUrls(editUrls.filter((_, idx) => idx !== i))}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition cursor-pointer"
                          title="Remove URL"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Google Drive Link (Optional)
                </label>
                <input
                  type="url"
                  value={editDriveUrl}
                  onChange={(e) => setEditDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Remark / Instruction
                </label>
                <textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  rows="3"
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAlloc(null)}
                  className="w-1/2 py-2.5 border border-slate-200 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold rounded-xl text-white transition flex items-center justify-center space-x-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
