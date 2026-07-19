import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, deleteField, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Plus, UserPlus, FolderPlus, Trash2, User, Briefcase, ShieldAlert, Layers, Key, Lock, Mail, Eye, EyeOff, X, Check, Camera, FileText, Download, Edit3, Send, ExternalLink, KeyRound } from 'lucide-react';
import { showToast } from './Toast';

const base64ToBlobUrl = (base64Data) => {
  if (!base64Data || typeof base64Data !== 'string') return '';
  if (!base64Data.startsWith('data:')) return base64Data;
  try {
    const parts = base64Data.split(';base64,');
    if (parts.length < 2) return base64Data;
    const contentType = parts[0].replace('data:', '');
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([uInt8Array], { type: contentType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Base64 to Blob error:', err);
    return base64Data;
  }
};

const compressAvatar = (file, maxWidth = 300, maxHeight = 300, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

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
  const [empCode, setEmpCode] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empBaseSalary, setEmpBaseSalary] = useState('');
  const [empColor, setEmpColor] = useState(PALETTE[0].hex);
  const [empPhoto, setEmpPhoto] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientIndustry, setClientIndustry] = useState('');

  const [postTypeName, setPostTypeName] = useState('');

  const [loadingEmp, setLoadingEmp] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);
  const [loadingPostType, setLoadingPostType] = useState(false);
  const [error, setError] = useState('');

  // Credential Management Modal state
  const [credModalEmp, setCredModalEmp] = useState(null);
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [showCredPass, setShowCredPass] = useState(false);

  // Edit Employee Modal state
  const [editEmp, setEditEmp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editColor, setEditColor] = useState(PALETTE[0].hex);
  const [editPhoto, setEditPhoto] = useState('');

  // Password Reset Requests state
  const [passwordRequests, setPasswordRequests] = useState([]);
  const [resetReqModal, setResetReqModal] = useState(null);
  const [newResetPass, setNewResetPass] = useState('');

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

    // 4. Password Reset Requests listener
    const qReq = query(collection(db, 'content_reports', 'data', 'password_requests'), orderBy('requestedAt', 'desc'));
    const unsubReq = onSnapshot(qReq, (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPasswordRequests(reqs.filter(r => r.status === 'pending'));
    });

    return () => {
      unsubscribeEmp();
      unsubscribeClient();
      unsubscribePost();
      unsubReq();
    };
  }, []);

  const handlePhotoSelect = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await compressAvatar(file);
      if (isEdit) {
        setEditPhoto(base64);
      } else {
        setEmpPhoto(base64);
      }
    } catch (err) {
      console.error('Photo error:', err);
      alert('Failed to process image file.');
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empName.trim() || !empRole.trim()) return;
    setLoadingEmp(true);
    setError('');

    try {
      const generatedCode = empCode.trim() ? empCode.trim() : `BID-${Math.floor(100 + Math.random() * 900)}`;
      await addDoc(collection(db, 'content_reports', 'data', 'employees'), {
        name: empName.trim(),
        code: generatedCode,
        role: empRole.trim(),
        baseSalary: Number(empBaseSalary) || 0,
        color: empColor,
        photo: empPhoto || '',
        resumeRequested: false,
        createdAt: new Date().toISOString(),
      });
      setEmpName('');
      setEmpCode('');
      setEmpRole('');
      setEmpBaseSalary('');
      setEmpPhoto('');
      setEmpColor(PALETTE[Math.floor(Math.random() * PALETTE.length)].hex);
    } catch (err) {
      console.error(err);
      setError('Failed to add employee. Please try again.');
    } finally {
      setLoadingEmp(false);
    }
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!editEmp || !editName.trim() || !editRole.trim()) return;

    try {
      await updateDoc(doc(db, 'content_reports', 'data', 'employees', editEmp.id), {
        name: editName.trim(),
        code: editCode.trim() || editEmp.code || `BID-${editEmp.id.substring(0, 4).toUpperCase()}`,
        role: editRole.trim(),
        baseSalary: Number(editBaseSalary) || 0,
        color: editColor,
        photo: editPhoto || '',
      });
      setEditEmp(null);
    } catch (err) {
      console.error('Update employee error:', err);
      alert('Failed to update employee details.');
    }
  };

  const handleRequestResume = async (emp) => {
    try {
      await updateDoc(doc(db, 'content_reports', 'data', 'employees', emp.id), {
        resumeRequested: true,
      });
      alert(`Resume request sent to ${emp.name}. They will see a prompt on their dashboard.`);
    } catch (err) {
      console.error('Request resume error:', err);
      alert('Failed to request resume.');
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

  // Save / Update login credentials for an employee
  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    if (!credModalEmp) return;
    if (!credUsername.trim() || !credPassword.trim()) {
      alert('Please enter both username/email and password.');
      return;
    }
    try {
      await updateDoc(doc(db, 'content_reports', 'data', 'employees', credModalEmp.id), {
        username: credUsername.trim().toLowerCase(),
        password: credPassword.trim(),
        hasLogin: true,
      });
      setCredModalEmp(null);
      setCredUsername('');
      setCredPassword('');
    } catch (err) {
      console.error('Failed to update credentials:', err);
      alert('Failed to save login credentials.');
    }
  };

  // Delete login credentials for an employee
  const handleDeleteCredentials = async (emp) => {
    if (window.confirm(`Delete login credentials for "${emp.name}"? They will no longer be able to log in.`)) {
      try {
        await updateDoc(doc(db, 'content_reports', 'data', 'employees', emp.id), {
          username: deleteField(),
          password: deleteField(),
          hasLogin: false,
        });
        if (credModalEmp?.id === emp.id) {
          setCredModalEmp(null);
        }
      } catch (err) {
        console.error('Failed to delete credentials:', err);
        alert('Failed to delete login credentials.');
      }
    }
  };

  // Handle Resolving Password Reset Request
  const handleResolvePasswordRequest = async (e) => {
    e.preventDefault();
    if (!resetReqModal || !newResetPass.trim()) return;

    try {
      const inputStr = (resetReqModal.employeeIdentifier || '').trim().toLowerCase();
      const matchedEmp = employees.find(emp => 
        emp.id === resetReqModal.employeeId ||
        emp.username?.toLowerCase() === inputStr ||
        emp.name?.toLowerCase() === inputStr ||
        emp.code?.toLowerCase() === inputStr
      );

      if (matchedEmp) {
        await updateDoc(doc(db, 'content_reports', 'data', 'employees', matchedEmp.id), {
          password: newResetPass.trim(),
          hasLogin: true
        });
      }

      await updateDoc(doc(db, 'content_reports', 'data', 'password_requests', resetReqModal.id), {
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      });

      showToast(`Password reset to "${newResetPass.trim()}" for ${resetReqModal.employeeIdentifier}!`, 'success');
      setResetReqModal(null);
      setNewResetPass('');
    } catch (err) {
      console.error('Resolve password request error:', err);
      showToast('Failed to reset password.', 'error');
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

      {/* PENDING PASSWORD RESET REQUEST NOTIFICATION BANNER */}
      {passwordRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-100 rounded-xl">
              <KeyRound className="h-5 w-5 text-amber-700 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-amber-900 leading-tight">
                🔔 Employee Password Reset Requests ({passwordRequests.length})
              </h2>
              <p className="text-xs text-amber-700">Employees requested password resets from login page.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {passwordRequests.map(req => (
              <div key={req.id} className="bg-white border border-amber-200 p-3.5 rounded-xl space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 text-sm">{req.employeeIdentifier}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Pending</span>
                  </div>
                  {req.note && <p className="text-xs text-slate-600 mt-1 italic font-medium">"{req.note}"</p>}
                  <span className="text-[10px] text-slate-400 block mt-1">Requested: {new Date(req.requestedAt).toLocaleString()}</span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setResetReqModal(req);
                      setNewResetPass(Math.random().toString(36).slice(-6) + '123');
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Reset Password & Share</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                Employee Code / ID (Optional)
              </label>
              <input
                type="text"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                placeholder="E.g., BID-101 (Auto-generated if empty)"
                className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Base Monthly Salary (₹)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={empBaseSalary}
                onChange={(e) => setEmpBaseSalary(e.target.value)}
                placeholder="E.g., 25000 (Confidential to Allocator)"
                className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Profile Photo (Optional)
              </label>
              <div className="flex items-center space-x-3">
                {empPhoto ? (
                  <img src={empPhoto} alt="Preview" className="h-10 w-10 rounded-full object-cover border border-indigo-200" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <Camera className="h-4 w-4" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoSelect(e, false)}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
            </div>

            {/* Premium Color Picker Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Assigned Theme Color
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
                      className={`flex flex-col space-y-3 p-3.5 rounded-xl border ${theme.bg} ${theme.border} transition duration-150 overflow-hidden w-full`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center space-x-3 min-w-0">
                          {emp.photo ? (
                            <img src={emp.photo} alt={emp.name} className="h-9 w-9 rounded-full object-cover border border-slate-200 shadow-xs shrink-0" />
                          ) : (
                            <div className="p-2 rounded-lg bg-white border border-slate-100 shadow-xs shrink-0">
                              <User className={`h-4 w-4 ${theme.text}`} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 leading-snug truncate">{emp.name}</span>
                              {emp.hasLogin && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                  Login Active
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 block truncate">{emp.role} {emp.username ? `• @${emp.username}` : ''}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => {
                              setEditEmp(emp);
                              setEditName(emp.name);
                              setEditCode(emp.code || `BID-${emp.id.substring(0, 4).toUpperCase()}`);
                              setEditRole(emp.role);
                              setEditBaseSalary(emp.baseSalary ? String(emp.baseSalary) : '');
                              setEditColor(emp.color || PALETTE[0].hex);
                              setEditPhoto(emp.photo || '');
                            }}
                            className="p-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-500 rounded-lg transition duration-150 shadow-xs cursor-pointer"
                            title="Edit Employee"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setCredModalEmp(emp);
                              setCredUsername(emp.username || '');
                              setCredPassword(emp.password || '');
                            }}
                            className={`p-1.5 bg-white border rounded-lg transition duration-150 shadow-xs cursor-pointer ${
                              emp.hasLogin 
                                ? 'text-indigo-600 border-indigo-200 hover:bg-indigo-50' 
                                : 'text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                            title={emp.hasLogin ? 'Edit Login Credentials' : 'Assign Login Credentials'}
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                            className="p-1.5 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 text-slate-400 rounded-lg transition duration-150 shadow-xs cursor-pointer"
                            title="Delete Employee"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Base Salary & Resume Status Bar */}
                      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Salary: ₹{emp.baseSalary ? Number(emp.baseSalary).toLocaleString('en-IN') : '0'}
                        </span>
                        {emp.resume ? (
                          <a
                            href={emp.resume}
                            download={emp.resumeName || `${emp.name}_Resume`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold hover:bg-indigo-100 transition cursor-pointer text-xs shadow-2xs shrink-0"
                            title="Download Resume"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Resume</span>
                          </a>
                        ) : emp.resumeRequested ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                            Requested
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRequestResume(emp)}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 font-semibold transition cursor-pointer text-xs shrink-0"
                          >
                            <Send className="h-3 w-3" />
                            <span>Request Resume</span>
                          </button>
                        )}
                      </div>
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
      {/* CREDENTIALS MODAL */}
      {credModalEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setCredModalEmp(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setCredModalEmp(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Key className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Employee Credentials</h3>
                <p className="text-xs text-slate-500">Assign login access for {credModalEmp.name}</p>
              </div>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Username / Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={credUsername}
                    onChange={(e) => setCredUsername(e.target.value)}
                    placeholder="e.g. anjali@company.com or anjali_dev"
                    className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showCredPass ? 'text' : 'password'}
                    required
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    placeholder="Set password"
                    className="block w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCredPass(!showCredPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showCredPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {credModalEmp.hasLogin ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteCredentials(credModalEmp)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Credentials</span>
                  </button>
                ) : <div />}

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1 shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Credentials</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT EMPLOYEE MODAL */}
      {editEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setEditEmp(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setEditEmp(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Edit3 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Employee</h3>
                <p className="text-xs text-slate-500">Update details & photo for {editEmp.name}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Employee Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Employee Code / ID
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="E.g., BID-101"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  required
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Base Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={editBaseSalary}
                  onChange={(e) => setEditBaseSalary(e.target.value)}
                  placeholder="Base Salary in ₹ (Confidential)"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Profile Photo
                </label>
                <div className="flex items-center space-x-3">
                  {editPhoto ? (
                    <img src={editPhoto} alt="Preview" className="h-10 w-10 rounded-full object-cover border border-indigo-200" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                      <Camera className="h-4 w-4" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoSelect(e, true)}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Assigned Theme Color
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PALETTE.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setEditColor(color.hex)}
                      className={`h-8 w-full rounded-xl border transition-all ${
                        editColor === color.hex 
                          ? 'ring-2 ring-indigo-500 scale-105 border-indigo-600' 
                          : 'border-slate-200 hover:scale-105 shadow-xs'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditEmp(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* RESET EMPLOYEE PASSWORD MODAL */}
      {resetReqModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setResetReqModal(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full relative space-y-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setResetReqModal(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <KeyRound className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Employee Password</h3>
                <p className="text-xs text-slate-500">For {resetReqModal.employeeIdentifier}</p>
              </div>
            </div>

            <form onSubmit={handleResolvePasswordRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    value={newResetPass}
                    onChange={(e) => setNewResetPass(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setNewResetPass(Math.random().toString(36).slice(-6) + '123')}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs shrink-0 cursor-pointer"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900 text-[11px] space-y-1">
                <span className="font-bold block">💡 Quick Share Note:</span>
                <p>After saving, you can copy or share this new password directly with the employee.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetReqModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
