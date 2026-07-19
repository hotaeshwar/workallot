import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, onSnapshot, query, where, updateDoc, doc, addDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  Clock, Calendar, LogOut, CheckCircle, AlertCircle, 
  ExternalLink, Music, Video, Download, Eye, X, MessageSquare, 
  Send, FileText, Gift, Megaphone, Check, ShieldAlert, Award,
  Sparkles, Sun, Moon, Sunrise, Play, Square, Coffee, HeartHandshake, User, UploadCloud, Trash2, Bell, CheckSquare 
} from 'lucide-react';
import { showToast } from './Toast';

const getPostTypeBadgeStyle = (type) => {
  const t = (type || '').toLowerCase();
  if (t === 'story') return 'bg-purple-50 text-purple-700 border border-purple-200';
  if (t === 'reel') return 'bg-pink-50 text-pink-700 border border-pink-200';
  if (t === 'post') return 'bg-sky-50 text-sky-700 border border-sky-200';
  if (t === 'pdf') return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (t.includes('banner') || t.includes('flyer')) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }
  if (t === 'printable') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (t.includes('logo') || t.includes('vector')) {
    return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
  }
  return 'bg-slate-50 text-slate-700 border border-slate-200';
};

export default function EmployeeDashboard({ employee, onLogout }) {
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'attendance', 'leaves', 'announcements'
  const [empData, setEmpData] = useState(employee);
  const [istTime, setIstTime] = useState('');
  const [istDate, setIstDate] = useState('');
  const [greeting, setGreeting] = useState('');
  const [greetingIcon, setGreetingIcon] = useState('sun');

  // Resume Upload state
  const [resumeUploading, setResumeUploading] = useState(false);
  const [viewResumeModal, setViewResumeModal] = useState(false);

  // Tasks state
  const [allocations, setAllocations] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);
  const [reasonModalTask, setReasonModalTask] = useState(null);
  const [incompleteReason, setIncompleteReason] = useState('');

  // Work Details & Hurdles Report Modal state
  const [reportModalTask, setReportModalTask] = useState(null);
  const [reportWorkDone, setReportWorkDone] = useState('');
  const [reportHurdles, setReportHurdles] = useState('');
  const [reportStatus, setReportStatus] = useState('completed');

  // Attendance state
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Leave application state
  const [leaves, setLeaves] = useState([]);
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDoc, setLeaveDoc] = useState('');
  const [leaveDocName, setLeaveDocName] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);

  // Bell Notifications state
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`workalloc_read_notifs_${employee.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      return [];
    }
  });
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  // Running Clock & Greeting Calculation (IST)
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

      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('en-US', timeOptions).format(now);
      const dateStr = new Intl.DateTimeFormat('en-US', dateOptions).format(now);

      // Extract hour in IST
      const istHourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
      }).format(now);
      const hour = parseInt(istHourStr, 10);

      let greet = 'Good Day';
      let icon = 'sun';
      if (hour >= 5 && hour < 12) {
        greet = 'Good Morning';
        icon = 'sunrise';
      } else if (hour >= 12 && hour < 17) {
        greet = 'Good Afternoon';
        icon = 'sun';
      } else if (hour >= 17 && hour < 22) {
        greet = 'Good Evening';
        icon = 'sunset';
      } else {
        greet = 'Good Night';
        icon = 'moon';
      }

      setIstTime(timeStr);
      setIstDate(dateStr);
      setGreeting(greet);
      setGreetingIcon(icon);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to employee document updates
  useEffect(() => {
    if (!employee?.id) return;
    const unsubEmpDoc = onSnapshot(doc(db, 'content_reports', 'data', 'employees', employee.id), (snapshot) => {
      if (snapshot.exists()) {
        setEmpData({ id: snapshot.id, ...snapshot.data() });
      }
    });

    const unsubAlloc = onSnapshot(collection(db, 'content_reports', 'data', 'allocations'), (snapshot) => {
      const alls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const empAllocs = alls.filter(a => a.employeeId === employee.id);
      empAllocs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAllocations(empAllocs);
    });

    // Fetch Attendance records for this employee
    const unsubAtt = onSnapshot(collection(db, 'content_reports', 'data', 'attendance'), (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const empRecords = records.filter(r => r.employeeId === employee.id);
      empRecords.sort((a, b) => new Date(b.clockInIso) - new Date(a.clockInIso));
      setAttendanceRecords(empRecords);

      // Check if there is an active clocked-in session
      const running = empRecords.find(r => r.status === 'clocked_in');
      setActiveSession(running || null);
    });

    // Fetch Leaves for this employee
    const unsubLeaves = onSnapshot(collection(db, 'content_reports', 'data', 'leaves'), (snapshot) => {
      const levs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const empLeaves = levs.filter(l => l.employeeId === employee.id);
      empLeaves.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLeaves(empLeaves);
    });

    // Fetch Announcements
    const unsubAnn = onSnapshot(collection(db, 'content_reports', 'data', 'announcements'), (snapshot) => {
      const anns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      anns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAnnouncements(anns);
    });

    return () => {
      unsubEmpDoc();
      unsubAlloc();
      unsubAtt();
      unsubLeaves();
      unsubAnn();
    };
  }, [employee?.id]);

  // Helper validator: allow ONLY PDF (.pdf) and Word (.docx / .doc) files
  const isValidDocFormat = (fileName) => {
    if (!fileName) return false;
    const name = fileName.toLowerCase();
    return name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.doc');
  };

  // Resume Document Upload Handler
  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!isValidDocFormat(file.name)) {
      showToast('Only PDF (.pdf) and Word (.docx) documents are allowed.', 'warning');
      e.target.value = '';
      return;
    }

    setResumeUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        await updateDoc(doc(db, 'content_reports', 'data', 'employees', employee.id), {
          resume: base64,
          resumeName: file.name,
          resumeUploadedAt: new Date().toISOString(),
          resumeRequested: false,
        });
        showToast('Resume document uploaded successfully!', 'success');
        setResumeUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Resume upload error:', err);
      showToast('Failed to upload resume document.', 'error');
      setResumeUploading(false);
    }
  };

  // Timer counter for active clock-in session
  useEffect(() => {
    let timer;
    if (activeSession?.clockInIso) {
      const calcElapsed = () => {
        const start = new Date(activeSession.clockInIso).getTime();
        const now = new Date().getTime();
        const diffSec = Math.floor((now - start) / 1000);
        setElapsedSeconds(diffSec > 0 ? diffSec : 0);
      };
      calcElapsed();
      timer = setInterval(calcElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [activeSession]);

  // Clock In / Clock Out Handlers
  const handleClockIn = async () => {
    if (activeSession) return;
    try {
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      await addDoc(collection(db, 'content_reports', 'data', 'attendance'), {
        employeeId: employee.id,
        employeeName: employee.name,
        date: todayStr,
        clockInTime: timeStr,
        clockInIso: now.toISOString(),
        clockOutTime: null,
        clockOutIso: null,
        workDurationMinutes: 0,
        status: 'clocked_in',
        createdAt: now.toISOString()
      });
    } catch (err) {
      console.error('Clock-in error:', err);
      alert('Failed to clock in.');
    }
  };

  const handleClockOut = async () => {
    if (!activeSession) return;
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const clockInMs = new Date(activeSession.clockInIso).getTime();
      const diffMinutes = Math.round((now.getTime() - clockInMs) / 60000);

      await updateDoc(doc(db, 'content_reports', 'data', 'attendance', activeSession.id), {
        clockOutTime: timeStr,
        clockOutIso: now.toISOString(),
        workDurationMinutes: diffMinutes,
        status: 'clocked_out'
      });
    } catch (err) {
      console.error('Clock-out error:', err);
      alert('Failed to clock out.');
    }
  };

  // Leave Supporting Document Select Handler
  const handleLeaveDocSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!isValidDocFormat(file.name)) {
      alert('Invalid file format! Only PDF (.pdf) and Word (.docx) documents are allowed.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setLeaveDoc(event.target.result);
      setLeaveDocName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Upload document for an existing leave request if requested or disapproved
  const handleUploadDocForLeave = async (leaveId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!isValidDocFormat(file.name)) {
      alert('Invalid file format! Only PDF (.pdf) and Word (.docx) documents are allowed.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      try {
        await updateDoc(doc(db, 'content_reports', 'data', 'leaves', leaveId), {
          document: base64,
          documentName: file.name,
          docRequested: false,
          status: 'pending', // Resubmit for Allocator approval
          resubmitted: true,
          resubmittedAt: new Date().toISOString()
        });
        alert('Supporting proof uploaded successfully! Your leave application has been resubmitted to the Allocator for approval.');
      } catch (err) {
        console.error('Document upload error:', err);
        alert('Failed to upload document.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Leave Submit Handler
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;
    setSubmittingLeave(true);

    try {
      await addDoc(collection(db, 'content_reports', 'data', 'leaves'), {
        employeeId: employee.id,
        employeeName: employee.name,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        leaveType,
        reason: leaveReason.trim(),
        document: leaveDoc || '',
        documentName: leaveDocName || '',
        docRequested: false,
        status: 'pending',
        allocatorFeedback: '',
        createdAt: new Date().toISOString()
      });

      setLeaveReason('');
      setLeaveDoc('');
      setLeaveDocName('');
      showToast('Leave application submitted successfully!', 'success');
    } catch (err) {
      console.error('Apply leave error:', err);
      showToast('Failed to submit leave application.', 'error');
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Delete Handlers for Employee Dashboard
  const handleDeleteAttendanceRecord = async (id) => {
    if (window.confirm('Delete this attendance record?')) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'attendance', id));
        showToast('Attendance record deleted successfully!', 'success');
      } catch (err) {
        console.error('Delete attendance error:', err);
        showToast('Failed to delete attendance record.', 'error');
      }
    }
  };

  const handleDeleteLeaveRecord = async (id) => {
    if (window.confirm('Delete this leave application?')) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'leaves', id));
        showToast('Leave application deleted successfully!', 'success');
      } catch (err) {
        console.error('Delete leave error:', err);
        showToast('Failed to delete leave application.', 'error');
      }
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('Remove this announcement/shared file from your view?')) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'announcements', id));
        showToast('Item deleted successfully!', 'success');
      } catch (err) {
        console.error('Delete announcement error:', err);
        showToast('Failed to delete item.', 'error');
      }
    }
  };

  const handleDeleteTask = async (task) => {
    if (window.confirm(`Delete assigned task for "${task.clientName}" (${task.date})?`)) {
      try {
        const parentAlloc = task.parentAlloc;
        if (task.taskIndex >= 0 && parentAlloc.tasks && parentAlloc.tasks.length > 1) {
          const updatedTasks = parentAlloc.tasks.filter((_, idx) => idx !== task.taskIndex);
          await updateDoc(doc(db, 'content_reports', 'data', 'allocations', parentAlloc.id), {
            tasks: updatedTasks
          });
        } else {
          await deleteDoc(doc(db, 'content_reports', 'data', 'allocations', parentAlloc.id));
        }
        showToast('Task deleted successfully!', 'success');
      } catch (err) {
        console.error('Delete task error:', err);
        showToast('Failed to delete task.', 'error');
      }
    }
  };

  // Flatten tasks for assigned allocations
  const myTasks = [];
  allocations.forEach(alloc => {
    if (alloc.tasks && alloc.tasks.length > 0) {
      alloc.tasks.forEach((t, idx) => {
        myTasks.push({
          id: `${alloc.id}_task_${idx}`,
          allocationId: alloc.id,
          taskIndex: idx,
          date: alloc.date,
          clientName: t.clientName || alloc.clientName || 'Client',
          type: t.type || 'story',
          urls: t.urls || [],
          driveUrl: t.driveUrl || '',
          mp3Url: t.mp3Url || '',
          mp4Url: t.mp4Url || '',
          remark: t.remark || '',
          status: t.status || 'allocated',
          reasonIncompleted: t.reasonIncompleted || '',
          workDoneDetails: t.workDoneDetails || '',
          hurdlesFaced: t.hurdlesFaced || '',
          completedAt: t.completedAt || '',
          approvalStatus: t.approvalStatus || 'pending', // 'pending', 'approved', 'disapproved'
          approvalRemark: t.approvalRemark || '',
          image: t.image || '',
          parentAlloc: alloc
        });
      });
    } else {
      myTasks.push({
        id: alloc.id,
        allocationId: alloc.id,
        taskIndex: -1,
        date: alloc.date,
        clientName: alloc.clientName || 'Client',
        type: alloc.type || 'story',
        urls: alloc.urls || [],
        driveUrl: alloc.driveUrl || '',
        mp3Url: alloc.mp3Url || '',
        mp4Url: alloc.mp4Url || '',
        remark: alloc.remark || '',
        status: alloc.status || 'allocated',
        reasonIncompleted: alloc.reasonIncompleted || '',
        workDoneDetails: alloc.workDoneDetails || '',
        hurdlesFaced: alloc.hurdlesFaced || '',
        completedAt: alloc.completedAt || '',
        approvalStatus: alloc.approvalStatus || 'pending',
        approvalRemark: alloc.approvalRemark || '',
        image: alloc.image || '',
        parentAlloc: alloc
      });
    }
  });

  // Save work completion details and hurdles report
  const handleSaveWorkReport = async (e) => {
    e.preventDefault();
    if (!reportModalTask) return;

    try {
      const parent = reportModalTask.parentAlloc;
      const nowIso = new Date().toISOString();

      if (reportModalTask.taskIndex === -1) {
        // Legacy single task
        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', reportModalTask.allocationId), {
          status: reportStatus,
          workDoneDetails: reportWorkDone.trim(),
          hurdlesFaced: reportHurdles.trim(),
          reasonIncompleted: reportStatus === 'incompleted' ? reportHurdles.trim() : '',
          completedAt: reportStatus === 'completed' ? nowIso : (parent.completedAt || ''),
          approvalStatus: 'pending' // reset approval status for Allocator to re-review
        });
      } else {
        // Multi-task allocation doc
        const updatedTasks = [...parent.tasks];
        updatedTasks[reportModalTask.taskIndex].status = reportStatus;
        updatedTasks[reportModalTask.taskIndex].workDoneDetails = reportWorkDone.trim();
        updatedTasks[reportModalTask.taskIndex].hurdlesFaced = reportHurdles.trim();
        updatedTasks[reportModalTask.taskIndex].reasonIncompleted = reportStatus === 'incompleted' ? reportHurdles.trim() : '';
        if (reportStatus === 'completed') {
          updatedTasks[reportModalTask.taskIndex].completedAt = nowIso;
        }
        updatedTasks[reportModalTask.taskIndex].approvalStatus = 'pending';

        const allCompleted = updatedTasks.every(t => t.status === 'completed');

        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', reportModalTask.allocationId), {
          tasks: updatedTasks,
          status: allCompleted ? 'completed' : 'allocated',
          archived: allCompleted
        });
      }

      alert('Work details and hurdles report saved successfully! Submitted to Allocator for review.');
      setReportModalTask(null);
    } catch (err) {
      console.error('Save work report error:', err);
      alert('Failed to save work details.');
    }
  };

  const formatTimer = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Employee Top Header */}
      <header className="bg-white/95 backdrop-blur border-b border-slate-200/80 sticky top-0 z-50 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Greeting & Employee Identity */}
          <div className="flex items-center space-x-3.5">
            <img src="/LOGO.png" alt="Building India Digital" className="h-10 sm:h-12 w-auto object-contain shrink-0" />
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            {empData.photo ? (
              <img src={empData.photo} alt={empData.name} className="h-11 w-11 rounded-full object-cover border-2 border-indigo-200 shadow-sm shrink-0" />
            ) : (
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
                {greetingIcon === 'sunrise' && <Sunrise className="h-6 w-6 text-amber-500 animate-bounce" />}
                {greetingIcon === 'sun' && <Sun className="h-6 w-6 text-amber-500 animate-spin-slow" />}
                {(greetingIcon === 'sunset' || greetingIcon === 'moon') && <Moon className="h-6 w-6 text-indigo-600" />}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {greeting}, {empData.name}!
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {empData.role || 'Employee'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Welcome to your personal work portal</p>
            </div>
          </div>

          {/* Running Clock & IST Date & Bell Notification */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center space-x-4 bg-slate-100/90 border border-slate-200/80 px-3.5 py-1.5 rounded-xl">
              <div className="flex items-center space-x-1.5 text-slate-600 text-xs font-semibold">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                <span>{istDate}</span>
              </div>
              <div className="w-px h-3.5 bg-slate-300"></div>
              <div className="flex items-center space-x-1.5 text-indigo-600 font-mono text-xs font-bold tracking-wider">
                <Clock className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                <span>{istTime} (IST)</span>
              </div>
            </div>

            {/* Task Assignment Bell Notification Button */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDrawer(!showNotifDrawer)}
                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition duration-150 shadow-xs cursor-pointer relative"
                title="Task Assignment Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {myTasks.filter(t => !readNotifIds.includes(t.id)).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                    {myTasks.filter(t => !readNotifIds.includes(t.id)).length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onLogout}
              className="p-2 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 text-slate-500 rounded-xl transition duration-150 shadow-xs cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Employee Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* RESUME REQUEST PROMPT BANNER */}
        {empData.resumeRequested && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <FileText className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-amber-900">Resume Document Requested by Allocator</h3>
                <p className="text-xs text-amber-700 mt-0.5">Your Allocator has requested you to upload your resume document.</p>
              </div>
            </div>
            <label className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer shrink-0">
              <span>Upload Resume Now</span>
              <input type="file" accept=".pdf,.docx,.doc" onChange={handleResumeUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* RESUME DOCUMENT SECTION / CARD */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Your Resume Document</h3>
              <p className="text-xs text-slate-500">
                {empData.resume ? `Uploaded: ${empData.resumeName || 'Resume Document'}` : 'Upload your resume (PDF or Word .docx only)'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {empData.resume && (
              <button
                onClick={() => setViewResumeModal(true)}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer flex items-center space-x-1"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>View Resume</span>
              </button>
            )}
            <label className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1">
              <UploadCloud className="h-3.5 w-3.5" />
              <span>{empData.resume ? 'Update Resume' : 'Upload Resume'}</span>
              <input type="file" accept=".pdf,.docx,.doc" onChange={handleResumeUpload} className="hidden" />
            </label>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition duration-150 flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'tasks' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span>My Tasks ({myTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition duration-150 flex items-center justify-center space-x-2 cursor-pointer relative ${
              activeTab === 'attendance' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Attendance & Clock</span>
            {activeSession && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute top-2 right-2"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('leaves')}
            className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition duration-150 flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'leaves' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Apply Leave ({leaves.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition duration-150 flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'announcements' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Megaphone className="h-4 w-4" />
            <span>Announcements & Shared Files ({announcements.length})</span>
          </button>
        </div>

        {/* TAB 1: MY TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Work Assigned to You</h2>
                  <p className="text-xs text-slate-500">View tasks allocated by your Allocator, update work status, and check review feedback.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tasks: {myTasks.length}</span>
                </div>
              </div>

              {myTasks.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                  No tasks assigned to you currently.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                        <th className="p-3">Date</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">Task Type</th>
                        <th className="p-3">Files & Links</th>
                        <th className="p-3">Allocator Remark</th>
                        <th className="p-3">Work Done & Hurdles</th>
                        <th className="p-3 text-center">Status & Review</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {myTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{task.date}</td>
                          <td className="p-3 font-bold text-slate-900">{task.clientName}</td>
                          <td className="p-3">
                            <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full capitalize ${getPostTypeBadgeStyle(task.type)}`}>
                              {task.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {task.image && (
                                <button onClick={() => setViewImageSrc(task.image)} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[11px] font-bold">Image</button>
                              )}
                              {task.driveUrl && (
                                <a href={task.driveUrl} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold">Drive</a>
                              )}
                              {task.mp3Url && (
                                <a href={task.mp3Url} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-bold">MP3</a>
                              )}
                              {task.mp4Url && (
                                <a href={task.mp4Url} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[11px] font-bold">MP4</a>
                              )}
                              {!task.image && !task.driveUrl && !task.mp3Url && !task.mp4Url && <span className="text-slate-400 italic text-[11px]">None</span>}
                            </div>
                          </td>
                          <td className="p-3 max-w-xs text-xs text-slate-600 truncate" title={task.remark}>{task.remark || 'N/A'}</td>
                          <td className="p-3 max-w-xs text-xs">
                            {task.workDoneDetails ? (
                              <div>
                                <span className="font-bold text-slate-800 block text-[11px]">Work Done:</span>
                                <span className="text-slate-600 truncate block max-w-xs" title={task.workDoneDetails}>{task.workDoneDetails}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Pending details</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded ${
                              task.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              task.status === 'incompleted' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {task.status}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => {
                                  setReportModalTask(task);
                                  setReportStatus(task.status || 'completed');
                                  setReportWorkDone(task.workDoneDetails || '');
                                  setReportHurdles(task.hurdlesFaced || '');
                                }}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                                title="Write / Edit Work Details & Hurdles"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Report</span>
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition cursor-pointer"
                                title="Delete Task"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE & CLOCK */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CLOCK IN / OUT ACTION BOX */}
              <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between items-center text-center space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Attendance Clock</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Click to log your work shift start and end times</p>
                </div>

                {/* Big Animated Clock Timer Visual */}
                <div className="flex flex-col items-center justify-center space-y-3 py-4">
                  <div className={`p-6 rounded-full border-4 transition-all duration-300 ${
                    activeSession 
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/20 animate-pulse' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <Clock className="h-14 w-14" />
                  </div>

                  {activeSession ? (
                    <div>
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block">Currently Shift Active</span>
                      <span className="text-2xl font-black font-mono text-slate-900 tracking-wider">
                        {formatTimer(elapsedSeconds)}
                      </span>
                      <span className="text-xs text-slate-500 block mt-1">Clocked in at {activeSession.clockInTime}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Off Duty</span>
                      <span className="text-xl font-bold text-slate-600 block mt-1">Ready to Clock In</span>
                    </div>
                  )}
                </div>

                {/* Clock In / Out Buttons */}
                <div className="w-full">
                  {activeSession ? (
                    <button
                      onClick={handleClockOut}
                      className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl transition duration-150 shadow-md shadow-rose-600/20 flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Square className="h-4 w-4" />
                      <span>Clock Out Now</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleClockIn}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition duration-150 shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Clock In Now</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ATTENDANCE HISTORY TABLE */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900">Your Attendance History</h2>
                  <span className="text-xs font-semibold text-slate-500">{attendanceRecords.length} records</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white flex-1">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                        <th className="p-3">Date</th>
                        <th className="p-3">Clock In</th>
                        <th className="p-3">Clock Out</th>
                        <th className="p-3">Work Duration</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {attendanceRecords.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-10 text-slate-400">
                            No attendance records recorded yet.
                          </td>
                        </tr>
                      ) : (
                        attendanceRecords.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-semibold text-slate-900">{rec.date}</td>
                            <td className="p-3 font-mono text-emerald-700 font-semibold">{rec.clockInTime}</td>
                            <td className="p-3 font-mono text-rose-700 font-semibold">{rec.clockOutTime || 'Active...'}</td>
                            <td className="p-3 font-semibold text-slate-800">
                              {rec.workDurationMinutes ? `${Math.floor(rec.workDurationMinutes / 60)}h ${rec.workDurationMinutes % 60}m` : 'In progress'}
                            </td>
                            <td className="p-3 text-center">
                              {rec.status === 'clocked_in' ? (
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Clocked In
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  Completed
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteAttendanceRecord(rec.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition cursor-pointer"
                                title="Delete Attendance Record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: APPLY LEAVE */}
        {activeTab === 'leaves' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEAVE FORM */}
            <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Apply for Leave</h2>
                <p className="text-xs text-slate-500 mt-0.5">Submit leave applications directly to your Allocator</p>
              </div>

              <form onSubmit={handleApplyLeave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Leave Type
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Earned / Paid Leave">Earned / Paid Leave</option>
                    <option value="Emergency / Other">Emergency / Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Reason for Leave
                  </label>
                  <textarea
                    required
                    rows="3"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Provide reason for requesting leave..."
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Supporting Document (PDF or Word .docx Only)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={handleLeaveDocSelect}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {leaveDocName && (
                    <span className="text-[10px] font-bold text-emerald-600 block mt-1">
                      ✓ Attached: {leaveDocName}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Submit Leave Request</span>
                </button>
              </form>
            </div>

            {/* LEAVE HISTORY TABLE */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Your Leave History</h2>
                <span className="text-xs font-semibold text-slate-500">{leaves.length} applications</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                      <th className="p-3">Dates</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Doc</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3">Allocator Feedback</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {leaves.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-slate-400">
                          No leave applications submitted yet.
                        </td>
                      </tr>
                    ) : (
                      leaves.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-semibold text-slate-900">
                            {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ''}
                          </td>
                          <td className="p-3 font-medium text-slate-700">{l.leaveType}</td>
                          <td className="p-3 max-w-xs truncate text-slate-600" title={l.reason}>{l.reason}</td>
                          <td className="p-3">
                            {l.document ? (
                              <div className="flex flex-col space-y-1">
                                <a
                                  href={l.document}
                                  download={l.documentName || 'leave_document'}
                                  className="inline-flex items-center text-indigo-600 hover:underline font-bold text-xs"
                                >
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  <span>View Doc</span>
                                </a>
                                <label className="inline-flex items-center text-[10px] text-slate-500 hover:text-indigo-600 cursor-pointer">
                                  <span>Replace File</span>
                                  <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => handleUploadDocForLeave(l.id, e)} className="hidden" />
                                </label>
                              </div>
                            ) : (
                              <label className="inline-flex items-center text-xs font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-xl cursor-pointer transition shadow-2xs">
                                <UploadCloud className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                                <span>Upload Proof</span>
                                <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => handleUploadDocForLeave(l.id, e)} className="hidden" />
                              </label>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center space-y-1">
                              {l.status === 'approved' ? (
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Approved
                                </span>
                              ) : l.status === 'disapproved' ? (
                                <>
                                  <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-rose-100 text-rose-800 border border-rose-200">
                                    Disapproved
                                  </span>
                                  <label className="inline-flex items-center text-[10px] font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition mt-1">
                                    <span>Upload Proof to Resubmit</span>
                                    <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => handleUploadDocForLeave(l.id, e)} className="hidden" />
                                  </label>
                                </>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  {l.resubmitted ? 'Resubmitted (Pending)' : 'Pending'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 text-xs italic">
                            {l.allocatorFeedback || 'N/A'}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteLeaveRecord(l.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition cursor-pointer"
                              title="Delete Leave Application"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ANNOUNCEMENTS & SHARED DOCUMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Announcements, Birthday Wishes & Shared Files</h2>
                <p className="text-xs text-slate-500 mt-0.5">Stay updated with messages, company notices, and documents shared by your Allocator</p>
              </div>

              {announcements.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                  No announcements or shared documents posted yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {announcements.map((ann) => (
                    <div 
                      key={ann.id}
                      className={`p-5 rounded-2xl border transition duration-150 flex flex-col justify-between space-y-4 ${
                        ann.type === 'birthday' 
                          ? 'bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200 shadow-sm' 
                          : ann.type === 'document'
                          ? 'bg-gradient-to-br from-indigo-50 to-slate-50 border-indigo-200 shadow-sm'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          {ann.type === 'birthday' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-pink-100 text-pink-700 border border-pink-200">
                              <Gift className="h-3.5 w-3.5 mr-1 text-pink-600" /> Birthday Wishes
                            </span>
                          )}
                          {ann.type === 'document' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                              <FileText className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Shared Document
                            </span>
                          )}
                          {ann.type === 'announcement' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                              <Megaphone className="h-3.5 w-3.5 mr-1 text-amber-600" /> Notice / Announcement
                            </span>
                          )}

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-semibold text-slate-400">
                              {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}
                            </span>
                            <button
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="p-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition cursor-pointer"
                              title="Delete Announcement / File"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-900">{ann.title}</h3>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{ann.message}</p>
                      </div>

                      {/* Attached File/Document button */}
                      {ann.fileUrl && (
                        <div className="pt-3 border-t border-slate-200/60">
                          <a
                            href={ann.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Shared File</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* REASON MODAL FOR INCOMPLETED TASK */}
      {reasonModalTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setReasonModalTask(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setReasonModalTask(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reason for Incompletion</h3>
                <p className="text-xs text-slate-500">Provide a reason for "{reasonModalTask.clientName}" task</p>
              </div>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateTaskStatus(reasonModalTask, 'incompleted', incompleteReason);
              }} 
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Reason / Remarks for Not Completing
                </label>
                <textarea
                  required
                  rows="4"
                  value={incompleteReason}
                  onChange={(e) => setIncompleteReason(e.target.value)}
                  placeholder="Explain why the task could not be completed today..."
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReasonModalTask(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  Save Incomplete Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW IMAGE LIGHTBOX MODAL */}
      {viewImageSrc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setViewImageSrc(null)}>
          <div className="bg-white border border-slate-250 rounded-2xl p-3 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setViewImageSrc(null)}
              className="absolute top-2.5 right-2.5 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer z-10"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <div className="overflow-auto flex items-center justify-center p-2 mt-6">
              <img src={viewImageSrc} alt="Full view" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 px-2">
              <a 
                href={viewImageSrc} 
                download="task_file.jpg"
                className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center space-x-1 cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Download File</span>
              </a>
            </div>
          </div>
        </div>
      )}
      {/* VIEW YOUR RESUME MODAL */}
      {viewResumeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setViewResumeModal(false)}>
          <div className="bg-white border border-slate-250 rounded-2xl p-4 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setViewResumeModal(false)}
              className="absolute top-3 right-3 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer z-10"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <FileText className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Your Resume Document</h3>
                <p className="text-xs text-slate-500">{empData.resumeName || 'Resume Document'}</p>
              </div>
            </div>
            
            <div className="overflow-auto flex-1 p-2 flex items-center justify-center mt-3">
              {empData.resume && empData.resume.startsWith('data:image') ? (
                <img src={empData.resume} alt="Resume" className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm" />
              ) : (
                <div className="text-center p-8 border border-slate-200 rounded-xl bg-slate-50">
                  <FileText className="h-12 w-12 text-indigo-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Resume Document Attached</p>
                  <p className="text-xs text-slate-500 mt-1">File: {empData.resumeName || 'Resume Document'}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 px-2">
              <a 
                href={empData.resume} 
                download={empData.resumeName || `${empData.name}_Resume`}
                className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center space-x-1 cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Download Resume</span>
              </a>
            </div>
          </div>
        </div>
      )}
      {/* WORK DETAILS & HURDLES SUBMISSION MODAL */}
      {reportModalTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setReportModalTask(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xl max-w-lg w-full relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setReportModalTask(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Work Report & Hurdles Entry</h3>
                <p className="text-xs text-slate-500">For {reportModalTask.clientName} ({reportModalTask.type})</p>
              </div>
            </div>

            <form onSubmit={handleSaveWorkReport} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Work Status
                </label>
                <select
                  value={reportStatus}
                  onChange={(e) => setReportStatus(e.target.value)}
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress / Need Support</option>
                  <option value="incompleted">Incompleted / On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Details of Work Done
                </label>
                <textarea
                  rows="4"
                  required={reportStatus === 'completed'}
                  value={reportWorkDone}
                  onChange={(e) => setReportWorkDone(e.target.value)}
                  placeholder="Describe key work completed, links generated, posts created, design files exported..."
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
                  Hurdles & Difficulties Faced (Optional / If Any)
                </label>
                <textarea
                  rows="3"
                  value={reportHurdles}
                  onChange={(e) => setReportHurdles(e.target.value)}
                  placeholder="Describe any technical issues, delayed assets, internet problems, or difficulties faced during work..."
                  className="block w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200/80 rounded-xl text-amber-900 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReportModalTask(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Save & Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK ASSIGNMENT BELL NOTIFICATIONS DRAWER */}
      {showNotifDrawer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-start justify-end p-4 sm:p-6" onClick={() => setShowNotifDrawer(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl max-w-md w-full relative mt-14 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowNotifDrawer(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 pr-8">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <Bell className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-none">Task Notifications</h3>
                  <p className="text-xs text-slate-500 mt-1">Newly assigned tasks from Allocator</p>
                </div>
              </div>

              {myTasks.filter(t => !readNotifIds.includes(t.id)).length > 0 && (
                <button
                  onClick={() => {
                    const allIds = myTasks.map(t => t.id);
                    const updated = Array.from(new Set([...readNotifIds, ...allIds]));
                    setReadNotifIds(updated);
                    localStorage.setItem(`workalloc_read_notifs_${employee.id}`, JSON.stringify(updated));
                    showToast('All notifications cleared permanently!', 'info');
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
              {myTasks.filter(t => !readNotifIds.includes(t.id)).length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-600">All notifications read!</p>
                  <p className="text-[11px]">No unread task assignments.</p>
                </div>
              ) : (
                myTasks.filter(t => !readNotifIds.includes(t.id)).map(task => (
                  <div key={task.id} className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded-full capitalize ${getPostTypeBadgeStyle(task.type)}`}>
                          {task.type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">{task.date}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{task.clientName}</h4>
                      {task.remark && <p className="text-xs text-slate-600 mt-1 italic">"{task.remark}"</p>}
                    </div>

                    <div className="pt-2 border-t border-indigo-100 flex justify-end">
                      <button
                        onClick={() => {
                          const updated = [...readNotifIds, task.id];
                          setReadNotifIds(updated);
                          localStorage.setItem(`workalloc_read_notifs_${employee.id}`, JSON.stringify(updated));
                          showToast('Notification marked as read.', 'info');
                        }}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] transition shadow-2xs flex items-center space-x-1 cursor-pointer"
                      >
                        <CheckSquare className="h-3 w-3" />
                        <span>Mark as Read</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
