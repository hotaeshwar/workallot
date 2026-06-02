import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy 
} from 'firebase/firestore';
import { 
  PlusCircle, Edit3, Trash2, Archive, Search, ExternalLink, 
  CheckCircle, AlertCircle, RefreshCw, X, Save, Plus, Trash, Share2 
} from 'lucide-react';

export default function WorkAllocation() {
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [allocations, setAllocations] = useState([]);
  
  // Form states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [allocationDate, setAllocationDate] = useState(
    new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
  );

  // Multiple tasks state in creation form
  const [tasks, setTasks] = useState([
    { clientId: '', type: 'story', urls: [''], driveUrl: '', remark: '', status: 'allocated' }
  ]);

  // Table states
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state
  const [editingAlloc, setEditingAlloc] = useState(null);
  const [editEmpId, setEditEmpId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTasks, setEditTasks] = useState([]);

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

  // Handlers for dynamic tasks in Creation form
  const handleAddTask = () => {
    setTasks([...tasks, { clientId: '', type: 'story', urls: [''], driveUrl: '', remark: '', status: 'allocated' }]);
  };

  const handleRemoveTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleUpdateTaskField = (index, field, value) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);
  };

  const handleAddTaskUrl = (taskIndex) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].urls = [...updatedTasks[taskIndex].urls, ''];
    setTasks(updatedTasks);
  };

  const handleRemoveTaskUrl = (taskIndex, urlIndex) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].urls = updatedTasks[taskIndex].urls.filter((_, i) => i !== urlIndex);
    setTasks(updatedTasks);
  };

  const handleUpdateTaskUrl = (taskIndex, urlIndex, value) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].urls[urlIndex] = value;
    setTasks(updatedTasks);
  };

  // Handlers for dynamic tasks in Edit form
  const handleAddEditTask = () => {
    setEditTasks([...editTasks, { clientId: '', type: 'story', urls: [''], driveUrl: '', remark: '', status: 'allocated' }]);
  };

  const handleRemoveEditTask = (index) => {
    setEditTasks(editTasks.filter((_, i) => i !== index));
  };

  const handleUpdateEditTaskField = (index, field, value) => {
    const updatedTasks = [...editTasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setEditTasks(updatedTasks);
  };

  const handleAddEditTaskUrl = (taskIndex) => {
    const updatedTasks = [...editTasks];
    updatedTasks[taskIndex].urls = [...updatedTasks[taskIndex].urls, ''];
    setEditTasks(updatedTasks);
  };

  const handleRemoveEditTaskUrl = (taskIndex, urlIndex) => {
    const updatedTasks = [...editTasks];
    updatedTasks[taskIndex].urls = updatedTasks[taskIndex].urls.filter((_, i) => i !== urlIndex);
    setEditTasks(updatedTasks);
  };

  const handleUpdateEditTaskUrl = (taskIndex, urlIndex, value) => {
    const updatedTasks = [...editTasks];
    updatedTasks[taskIndex].urls[urlIndex] = value;
    setEditTasks(updatedTasks);
  };

  const shareRowOnWhatsApp = (alloc) => {
    const rowTasks = alloc.tasks && alloc.tasks.length > 0 ? alloc.tasks : [{
      clientId: alloc.clientId || '',
      clientName: alloc.clientName || '',
      type: alloc.type || 'story',
      urls: alloc.urls || (alloc.url ? [alloc.url] : []),
      driveUrl: alloc.driveUrl || '',
      remark: alloc.remark || '',
      status: alloc.status || 'allocated'
    }];

    let message = '';
    rowTasks.forEach((t, index) => {
      const resolvedStatus = t.status.charAt(0).toUpperCase() + t.status.slice(1);
      const refUrls = t.urls && t.urls.length > 0 ? t.urls.join(', ') : 'N/A';

      if (rowTasks.length > 1) {
        message += `*Task ${index + 1}:*\n`;
      }
      message += `• *Client:* ${t.clientName || alloc.clientName}\n`;
      message += `• *Work Type:* ${t.type.toUpperCase()}\n`;
      message += `• *Scheduled Date:* ${alloc.date}\n`;
      message += `• *Status:* ${resolvedStatus}\n`;
      if (t.driveUrl) {
        message += `• *Google Drive Link:* ${t.driveUrl}\n`;
      }
      if (refUrls && refUrls !== 'N/A') {
        message += `• *Reference URLs:* ${refUrls}\n`;
      }
      if (t.remark) {
        message += `• *Remarks:* ${t.remark}\n`;
      }
      message += `-----------------------------------------\n\n`;
    });

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCreateAllocation = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setError('Please select an employee.');
      return;
    }
    const hasUnselectedClient = tasks.some(t => !t.clientId);
    if (hasUnselectedClient) {
      setError('Please select a client for all tasks.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    const emp = employees.find(e => e.id === selectedEmpId);

    // Clean up blank urls, trim strings for all tasks
    const cleanedTasks = tasks.map(t => {
      const client = clients.find(c => c.id === t.clientId);
      return {
        clientId: t.clientId,
        clientName: client ? client.name : '',
        type: t.type,
        urls: t.urls.map(u => u.trim()).filter(u => u !== ''),
        driveUrl: t.driveUrl.trim(),
        remark: t.remark.trim(),
        status: 'allocated'
      };
    });

    const combinedClientNames = [...new Set(cleanedTasks.map(t => t.clientName))].join(', ');

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'allocations'), {
        employeeId: selectedEmpId,
        employeeName: emp.name,
        employeeColor: emp.color || '#94a3b8',
        clientId: tasks[0].clientId,
        clientName: combinedClientNames,
        tasks: cleanedTasks,
        date: allocationDate,
        status: 'allocated',
        archived: false,
        createdAt: new Date().toISOString(),
      });

      setSuccess('Work entry allocated successfully.');
      setTasks([{ clientId: '', type: 'story', urls: [''], driveUrl: '', remark: '', status: 'allocated' }]);
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
    setEditDate(alloc.date);
    
    // Support backward compatibility if older records don't have tasks list
    if (alloc.tasks && alloc.tasks.length > 0) {
      const tasksCopy = alloc.tasks.map(t => ({
        ...t,
        clientId: t.clientId || alloc.clientId || '',
        clientName: t.clientName || alloc.clientName || ''
      }));
      setEditTasks(tasksCopy);
    } else {
      const existingUrls = alloc.urls || (alloc.url ? [alloc.url] : ['']);
      setEditTasks([{
        clientId: alloc.clientId || '',
        clientName: alloc.clientName || '',
        type: alloc.type || 'story',
        urls: existingUrls.length > 0 ? existingUrls : [''],
        driveUrl: alloc.driveUrl || '',
        remark: alloc.remark || '',
        status: alloc.status || 'allocated'
      }]);
    }
  };

  const handleUpdateAllocation = async (e) => {
    e.preventDefault();
    if (!editEmpId) return;
    const hasUnselectedClient = editTasks.some(t => !t.clientId);
    if (hasUnselectedClient) {
      setError('Please select a client for all tasks.');
      return;
    }
    setLoading(true);

    const emp = employees.find(e => e.id === editEmpId);

    const cleanedTasks = editTasks.map(t => {
      const client = clients.find(c => c.id === t.clientId);
      return {
        clientId: t.clientId,
        clientName: client ? client.name : t.clientName,
        type: t.type,
        urls: t.urls.map(u => u.trim()).filter(u => u !== ''),
        driveUrl: t.driveUrl.trim(),
        remark: t.remark.trim(),
        status: t.status || 'allocated'
      };
    });

    const combinedClientNames = [...new Set(cleanedTasks.map(t => t.clientName))].join(', ');

    try {
      await updateDoc(doc(db, 'content_reports', 'data', 'allocations', editingAlloc.id), {
        employeeId: editEmpId,
        employeeName: emp.name,
        employeeColor: emp.color || '#94a3b8',
        clientId: editTasks[0].clientId,
        clientName: combinedClientNames,
        tasks: cleanedTasks,
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

  // Filter allocations by search term (searches employee, client, task details)
  const filteredAllocations = allocations.filter(alloc => {
    const term = searchTerm.toLowerCase();
    
    // Check main properties
    const mainMatch = (
      alloc.employeeName.toLowerCase().includes(term) ||
      (alloc.clientName && alloc.clientName.toLowerCase().includes(term)) ||
      alloc.date.includes(term)
    );

    if (mainMatch) return true;

    // Check tasks list
    const tasksToSearch = alloc.tasks && alloc.tasks.length > 0 ? alloc.tasks : [{
      clientId: alloc.clientId || '',
      clientName: alloc.clientName || '',
      type: alloc.type || '',
      remark: alloc.remark || ''
    }];

    return tasksToSearch.some(t => 
      t.type.toLowerCase().includes(term) ||
      t.remark.toLowerCase().includes(term) ||
      (t.clientName && t.clientName.toLowerCase().includes(term))
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
          Assign daily posts, reels, or stories to active employees for respective clients. Support multiple tasks in a single entry.
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
            <form onSubmit={handleCreateAllocation} className="space-y-5">
              <div className="space-y-4">
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
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    required
                    value={allocationDate}
                    onChange={(e) => setAllocationDate(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tasks ({tasks.length})</span>
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  {tasks.map((task, taskIdx) => (
                    <div key={taskIdx} className="p-4 bg-slate-50/50 border border-slate-200/80 rounded-xl space-y-3 relative">
                      {tasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(taskIdx)}
                          className="absolute top-3 right-3 text-red-500 hover:text-red-705 p-1 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          title="Remove Task"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}

                      <span className="block text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Task #{taskIdx + 1}</span>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Select Client
                        </label>
                        <select
                          required
                          value={task.clientId || ''}
                          onChange={(e) => handleUpdateTaskField(taskIdx, 'clientId', e.target.value)}
                          className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                          <option value="">-- Choose Client --</option>
                          {clients.map(cl => (
                            <option key={cl.id} value={cl.id}>{cl.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Post Type
                        </label>
                        <select
                          value={task.type}
                          onChange={(e) => handleUpdateTaskField(taskIdx, 'type', e.target.value)}
                          className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
                        >
                          <option value="story">Story</option>
                          <option value="reel">Reel</option>
                          <option value="post">Post</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Reference URLs (Optional)</span>
                          <button
                            type="button"
                            onClick={() => handleAddTaskUrl(taskIdx)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-850 font-bold flex items-center space-x-0.5 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add URL</span>
                          </button>
                        </label>
                        <div className="space-y-1.5">
                          {task.urls.map((u, urlIdx) => (
                            <div key={urlIdx} className="flex items-center space-x-1.5">
                              <input
                                type="url"
                                value={u}
                                onChange={(e) => handleUpdateTaskUrl(taskIdx, urlIdx, e.target.value)}
                                placeholder="https://instagram.com/p/..."
                                className="block flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                              {task.urls.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTaskUrl(taskIdx, urlIdx)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-150 rounded-lg transition cursor-pointer"
                                  title="Remove URL"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Google Drive Link (Optional)
                        </label>
                        <input
                          type="url"
                          value={task.driveUrl}
                          onChange={(e) => handleUpdateTaskField(taskIdx, 'driveUrl', e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Remark / Instructions
                        </label>
                        <textarea
                          value={task.remark}
                          onChange={(e) => handleUpdateTaskField(taskIdx, 'remark', e.target.value)}
                          placeholder="E.g., Publish at 6:00 PM with sports hashtags"
                          rows="2"
                          className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <PlusCircle className="h-4.5 w-4.5" />
                    <span>Allocate Work ({tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'})</span>
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
                  <th className="p-3.5">Types</th>
                  <th className="p-3.5">Scheduled Date</th>
                  <th className="p-3.5 max-w-xs">Tasks Details & Links</th>
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
                  filteredAllocations.map((alloc) => {
                    const rowTasks = alloc.tasks && alloc.tasks.length > 0 ? alloc.tasks : [{
                      clientId: alloc.clientId || '',
                      clientName: alloc.clientName || '',
                      type: alloc.type || 'story',
                      urls: alloc.urls || (alloc.url ? [alloc.url] : []),
                      driveUrl: alloc.driveUrl || '',
                      remark: alloc.remark || '',
                      status: alloc.status || 'allocated'
                    }];

                    return (
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
                        <td className="p-3.5 font-medium text-slate-707">
                          {(() => {
                            if (alloc.tasks && alloc.tasks.length > 0) {
                              const uniqueClients = [...new Set(alloc.tasks.map(t => t.clientName).filter(Boolean))];
                              return uniqueClients.join(', ') || alloc.clientName;
                            }
                            return alloc.clientName;
                          })()}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1">
                            {rowTasks.map((t, idx) => (
                              <span key={idx} className={`inline-flex w-fit px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize ${
                                t.type === 'story' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                t.type === 'reel' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                                'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}>
                                {t.type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600 font-mono text-xs font-semibold">
                          {new Date(alloc.date).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                          })}
                        </td>
                        <td className="p-3.5 text-xs text-slate-500 max-w-xs">
                          <div className="space-y-3">
                            {rowTasks.map((t, idx) => (
                              <div key={idx} className={`${rowTasks.length > 1 ? 'pb-2 border-b border-slate-100 last:pb-0 last:border-0' : ''}`}>
                                <div className="flex flex-wrap gap-1.5 items-center mb-1">
                                  {rowTasks.length > 1 && (
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                                      Task #{idx + 1} ({t.type})
                                    </span>
                                  )}
                                  <span className="inline-flex px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-700">
                                    Client: {t.clientName || alloc.clientName || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {t.driveUrl && (
                                    <a 
                                      href={t.driveUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-emerald-700 hover:text-emerald-800 hover:underline font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] mr-1"
                                    >
                                      <span>Drive Link</span>
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                  )}

                                  {t.urls && t.urls.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {t.urls.map((lnk, lIdx) => (
                                        <a 
                                          key={lIdx}
                                          href={lnk} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center text-indigo-700 hover:text-indigo-800 hover:underline font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]"
                                        >
                                          <span>Ref {t.urls.length > 1 ? lIdx + 1 : ''}</span>
                                          <ExternalLink className="h-3 w-3 ml-1" />
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    !t.driveUrl && <span className="text-slate-400 italic text-[10px]">No links</span>
                                  )}
                                </div>
                                {t.remark && (
                                  <div className="text-slate-600 text-xs mt-1 font-normal break-words" title={t.remark}>
                                    {t.remark}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => shareRowOnWhatsApp(alloc)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-lg transition shadow-xs cursor-pointer"
                              title="Share on WhatsApp"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(alloc)}
                              className="p-1.5 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-lg transition shadow-xs cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchiveAllocation(alloc.id)}
                              className="p-1.5 bg-white hover:bg-slate-50 text-amber-600 border border-slate-200 rounded-lg transition shadow-xs cursor-pointer"
                              title="Archive Entry"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAllocation(alloc.id)}
                              className="p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg transition shadow-xs cursor-pointer"
                              title="Delete Permanently"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* EDIT ALLOCATION MODAL */}
      {editingAlloc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 max-w-lg w-full rounded-2xl shadow-xl p-6 space-y-5 animate-zoom-in overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <Edit3 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Edit Allocation Entry</h3>
              </div>
              <button
                onClick={() => setEditingAlloc(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition text-slate-600 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAllocation} className="space-y-4">
              <div className="space-y-3">
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
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Tasks List inside Modal */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tasks ({editTasks.length})</span>
                  <button
                    type="button"
                    onClick={handleAddEditTask}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {editTasks.map((task, taskIdx) => (
                    <div key={taskIdx} className="p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3 relative">
                      {editTasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditTask(taskIdx)}
                          className="absolute top-2.5 right-2.5 text-red-500 hover:text-red-707 p-1 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          title="Remove Task"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Task #{taskIdx + 1}</span>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Select Client
                        </label>
                        <select
                          required
                          value={task.clientId || ''}
                          onChange={(e) => handleUpdateEditTaskField(taskIdx, 'clientId', e.target.value)}
                          className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                          <option value="">-- Choose Client --</option>
                          {clients.map(cl => (
                            <option key={cl.id} value={cl.id}>{cl.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Post Type
                        </label>
                        <select
                          value={task.type}
                          onChange={(e) => handleUpdateEditTaskField(taskIdx, 'type', e.target.value)}
                          className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
                        >
                          <option value="story">Story</option>
                          <option value="reel">Reel</option>
                          <option value="post">Post</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Reference URLs (Optional)</span>
                          <button
                            type="button"
                            onClick={() => handleAddEditTaskUrl(taskIdx)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-850 font-bold flex items-center space-x-0.5 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add URL</span>
                          </button>
                        </label>
                        <div className="space-y-1.5">
                          {task.urls.map((u, urlIdx) => (
                            <div key={urlIdx} className="flex items-center space-x-1.5">
                              <input
                                type="url"
                                value={u}
                                onChange={(e) => handleUpdateEditTaskUrl(taskIdx, urlIdx, e.target.value)}
                                placeholder="https://instagram.com/p/..."
                                className="block flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                              {task.urls.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditTaskUrl(taskIdx, urlIdx)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-150 rounded-lg transition cursor-pointer"
                                  title="Remove URL"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Google Drive Link (Optional)
                        </label>
                        <input
                          type="url"
                          value={task.driveUrl}
                          onChange={(e) => handleUpdateEditTaskField(taskIdx, 'driveUrl', e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Remark / Instructions
                        </label>
                        <textarea
                          value={task.remark}
                          onChange={(e) => handleUpdateEditTaskField(taskIdx, 'remark', e.target.value)}
                          rows="2"
                          className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAlloc(null)}
                  className="w-1/2 py-2.5 border border-slate-200 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold rounded-xl text-white transition flex items-center justify-center space-x-1.5 cursor-pointer"
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
