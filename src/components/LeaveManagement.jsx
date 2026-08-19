import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Calendar, Check, X, Filter, Trash2, CheckCircle, AlertCircle, MessageSquare, FileText, Download, Send, Eye, ExternalLink } from 'lucide-react';

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

export default function LeaveManagement({ isGuestMode = false }) {
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'pending', 'approved', 'disapproved'
  const [viewDocUrl, setViewDocUrl] = useState(null);

  // Action Modals state
  const [actionLeave, setActionLeave] = useState(null);
  const [actionType, setActionType] = useState(''); // 'approved' or 'disapproved'
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    // Fetch Employees
    const unsubEmp = onSnapshot(collection(db, 'content_reports', 'data', 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Leaves
    const unsubLeave = onSnapshot(collection(db, 'content_reports', 'data', 'leaves'), (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
      setLeaves(records);
    });

    return () => {
      unsubEmp();
      unsubLeave();
    };
  }, []);

  const filteredLeaves = useMemo(() => {
    let result = leaves;
    if (selectedEmpId !== 'all') {
      result = result.filter(l => l.employeeId === selectedEmpId);
    }
    if (selectedStatus !== 'all') {
      result = result.filter(l => l.status === selectedStatus);
    }
    return result;
  }, [leaves, selectedEmpId, selectedStatus]);

  const handleOpenActionModal = (leave, type) => {
    if (isGuestMode) return;
    setActionLeave(leave);
    setActionType(type);
    setFeedback(leave.allocatorFeedback || '');
  };

  const handleSaveAction = async (e) => {
    e.preventDefault();
    if (isGuestMode) return;
    if (!actionLeave) return;

    try {
      await updateDoc(doc(db, 'content_reports', 'data', 'leaves', actionLeave.id), {
        status: actionType,
        allocatorFeedback: feedback.trim()
      });

      setActionLeave(null);
      setFeedback('');
    } catch (err) {
      console.error('Update leave status error:', err);
      alert('Failed to update leave request.');
    }
  };

  const handleRequestDoc = async (leave) => {
    if (isGuestMode) return;
    try {
      await updateDoc(doc(db, 'content_reports', 'data', 'leaves', leave.id), {
        docRequested: true
      });
      alert(`Requested supporting document for ${leave.employeeName}'s leave application.`);
    } catch (err) {
      console.error('Request doc error:', err);
      alert('Failed to request document.');
    }
  };

  const handleDeleteLeave = async (id, empName) => {
    if (isGuestMode) return;
    if (window.confirm(`Delete leave application for ${empName}?`)) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'leaves', id));
      } catch (err) {
        console.error('Delete leave error:', err);
        alert('Failed to delete leave application.');
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Employee Leave Applications
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review leave requests submitted by employees. Approve or disapprove with custom feedback notes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* FILTERS SIDEBAR */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 h-fit shadow-sm">
          <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
            <Filter className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Leave Filters</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Filter by Employee
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Filter by Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="disapproved">Disapproved</option>
              </select>
            </div>
          </div>
        </div>

        {/* MAIN LEAVE TABLE */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Leave Applications ({filteredLeaves.length})</h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Date Range</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Document</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Feedback</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-slate-400">
                      No leave requests match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredLeaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{l.employeeName}</td>
                      <td className="p-3 font-medium text-slate-700">{l.leaveType}</td>
                      <td className="p-3 font-mono font-semibold text-slate-600">
                        {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ''}
                      </td>
                      <td className="p-3 max-w-xs truncate text-slate-600" title={l.reason}>
                        {l.reason}
                      </td>
                      <td className="p-3">
                        {l.document ? (
                          <a
                            href={l.document}
                            download={l.documentName || `${l.employeeName}_Leave_Doc`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold transition cursor-pointer text-xs shadow-2xs"
                            title="Download Document"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Doc</span>
                          </a>
                        ) : l.docRequested ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Requested
                          </span>
                        ) : (
                          !isGuestMode ? (
                            <button
                              onClick={() => handleRequestDoc(l)}
                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 font-semibold transition cursor-pointer text-xs"
                              title="Request supporting document proof from employee"
                            >
                              <Send className="h-3 w-3" />
                              <span>Request Doc</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">None</span>
                          )
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {l.status === 'approved' ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Approved
                          </span>
                        ) : l.status === 'disapproved' ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-rose-100 text-rose-800 border border-rose-200">
                            Disapproved
                          </span>
                        ) : l.resubmitted ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse">
                            Proof Uploaded (Pending)
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs italic text-slate-500 max-w-xs truncate" title={l.allocatorFeedback}>
                        {l.allocatorFeedback || 'None'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {!isGuestMode ? (
                            <>
                              <button
                                onClick={() => handleOpenActionModal(l, 'approved')}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition cursor-pointer"
                                title="Approve Leave"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenActionModal(l, 'disapproved')}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition cursor-pointer"
                                title="Disapprove Leave"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLeave(l.id, l.employeeName)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 rounded-lg transition cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Read Only</span>
                          )}
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

      {/* APPROVE / DISAPPROVE ACTION MODAL */}
      {actionLeave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setActionLeave(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setActionLeave(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2.5 rounded-xl border ${
                actionType === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
              }`}>
                {actionType === 'approved' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 capitalize">{actionType} Leave Request</h3>
                <p className="text-xs text-slate-500">For {actionLeave.employeeName} ({actionLeave.leaveType})</p>
              </div>
            </div>

            <form onSubmit={handleSaveAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Optional Allocator Feedback / Remark
                </label>
                <textarea
                  rows="3"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g., Approved with pay. Enjoy your break! or Disapproved due to project deadline..."
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionLeave(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition cursor-pointer shadow-sm ${
                    actionType === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {actionType === 'approved' ? 'Approval' : 'Disapproval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
