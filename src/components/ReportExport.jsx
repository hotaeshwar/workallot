import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Filter, 
  Download, ExternalLink, Share2, X,
  Music, Video, Trash2, Check, CheckCircle, AlertCircle, Edit3, Save
} from 'lucide-react';

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

export default function ReportExport() {
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [allocations, setAllocations] = useState([]);
  
  // Filter settings
  const [filterType, setFilterType] = useState('client'); // 'client' or 'employee'
  const [selectedClientId, setSelectedClientId] = useState('all');
  const [selectedEmpId, setSelectedEmpId] = useState('all');
  
  // Date settings
  const [dateRangeType, setDateRangeType] = useState('monthly'); // 'daily', 'weekly', 'monthly', 'all'
  const [referenceDate, setReferenceDate] = useState(
    new Date().toLocaleDateString('en-CA')
  );

  const [viewImageSrc, setViewImageSrc] = useState(null);
  const [viewReportTask, setViewReportTask] = useState(null);

  // Edit Task Modal state
  const [editingTask, setEditingTask] = useState(null);
  const [editClientId, setEditClientId] = useState('');
  const [editType, setEditType] = useState('story');
  const [editDate, setEditDate] = useState('');
  const [editStatus, setEditStatus] = useState('allocated');
  const [editDriveUrl, setEditDriveUrl] = useState('');
  const [editMp3Url, setEditMp3Url] = useState('');
  const [editMp4Url, setEditMp4Url] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [editWorkDoneDetails, setEditWorkDoneDetails] = useState('');
  const [editHurdlesFaced, setEditHurdlesFaced] = useState('');

  // Fetch all allocations (including archived ones so they can download history)
  useEffect(() => {
    // 1. Fetch Employees
    const unsubEmp = onSnapshot(collection(db, 'content_reports', 'data', 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Fetch Clients
    const unsubClient = onSnapshot(collection(db, 'content_reports', 'data', 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Fetch All Allocations (active and archived)
    const unsubAlloc = onSnapshot(collection(db, 'content_reports', 'data', 'allocations'), (snapshot) => {
      const alls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort desc
      alls.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAllocations(alls);
    });

    return () => {
      unsubEmp();
      unsubClient();
      unsubAlloc();
    };
  }, []);

  // Helper date calculations
  const getWeekRange = (dateStr) => {
    const curr = new Date(dateStr);
    const first = curr.getDate() - curr.getDay(); // Sunday
    
    const start = new Date(curr.setDate(first)).toLocaleDateString('en-CA');
    const end = new Date(curr.setDate(first + 6)).toLocaleDateString('en-CA');
    
    return { start, end };
  };

  const getMonthRange = (dateStr) => {
    const curr = new Date(dateStr);
    const y = curr.getFullYear();
    const m = curr.getMonth();
    
    const start = new Date(y, m, 1).toLocaleDateString('en-CA');
    const end = new Date(y, m + 1, 0).toLocaleDateString('en-CA');
    
    return { start, end };
  };

  // Re-run filtering whenever selectors change
  const filteredData = useMemo(() => {
    let result = [...allocations];

    // 1. Apply Entity Filters
    if (filterType === 'client') {
      if (selectedClientId !== 'all') {
        result = result.filter(a => {
          if (a.clientId === selectedClientId) return true;
          if (a.tasks && a.tasks.length > 0) {
            return a.tasks.some(t => t.clientId === selectedClientId);
          }
          return false;
        });
      }
    } else {
      if (selectedEmpId !== 'all') {
        result = result.filter(a => a.employeeId === selectedEmpId);
      }
    }

    // 2. Apply Date Range Filters
    if (dateRangeType === 'daily') {
      result = result.filter(a => a.date === referenceDate);
    } else if (dateRangeType === 'weekly') {
      const { start, end } = getWeekRange(referenceDate);
      result = result.filter(a => a.date >= start && a.date <= end);
    } else if (dateRangeType === 'monthly') {
      const { start, end } = getMonthRange(referenceDate);
      result = result.filter(a => a.date >= start && a.date <= end);
    }

    return result;
  }, [allocations, filterType, selectedClientId, selectedEmpId, dateRangeType, referenceDate]);

  // Map allocations down to individual tasks
  const flatTasks = useMemo(() => {
    const tasksList = [];
    filteredData.forEach(alloc => {
      const empObj = employees.find(e => e.id === alloc.employeeId);
      const empPhoto = empObj ? empObj.photo : '';

      if (alloc.tasks && alloc.tasks.length > 0) {
        alloc.tasks.forEach((t, index) => {
          const tClientId = t.clientId || alloc.clientId;
          const tClientName = t.clientName || alloc.clientName;

          // If filtering by client, and it is not "all", only include matching client tasks
          if (filterType === 'client' && selectedClientId !== 'all' && tClientId !== selectedClientId) {
            return;
          }

          tasksList.push({
            id: `${alloc.id}_task_${index}`,
            allocationId: alloc.id,
            employeeId: alloc.employeeId,
            employeeName: alloc.employeeName,
            employeeColor: alloc.employeeColor,
            employeePhoto: empPhoto,
            clientId: tClientId,
            clientName: tClientName,
            date: alloc.date,
            createdAt: alloc.createdAt,
            archived: alloc.archived,
            taskIndex: index,
            type: t.type,
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
            approvalStatus: t.approvalStatus || 'pending',
            approvalRemark: t.approvalRemark || '',
            image: t.image || '',
            isLegacy: false,
            parentAlloc: alloc
          });
        });
      } else {
        // Legacy support
        const tClientId = alloc.clientId;
        const tClientName = alloc.clientName;

        if (filterType === 'client' && selectedClientId !== 'all' && tClientId !== selectedClientId) {
          return;
        }

        tasksList.push({
          id: alloc.id,
          allocationId: alloc.id,
          employeeId: alloc.employeeId,
          employeeName: alloc.employeeName,
          employeeColor: alloc.employeeColor,
          employeePhoto: empPhoto,
          clientId: tClientId,
          clientName: tClientName,
          date: alloc.date,
          createdAt: alloc.createdAt,
          archived: alloc.archived,
          taskIndex: -1,
          type: alloc.type || 'story',
          urls: alloc.urls || (alloc.url ? [alloc.url] : []),
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
          isLegacy: true,
        });
      }
    });
    return tasksList;
  }, [filteredData, filterType, selectedClientId, employees]);
  // Open Edit Task Modal
  const handleOpenEdit = (taskItem) => {
    setEditingTask(taskItem);
    setEditClientId(taskItem.clientId || '');
    setEditType(taskItem.type || 'story');
    setEditDate(taskItem.date || new Date().toLocaleDateString('en-CA'));
    setEditStatus(taskItem.status || 'allocated');
    setEditDriveUrl(taskItem.driveUrl || '');
    setEditMp3Url(taskItem.mp3Url || '');
    setEditMp4Url(taskItem.mp4Url || '');
    setEditRemark(taskItem.remark || '');
    setEditWorkDoneDetails(taskItem.workDoneDetails || '');
    setEditHurdlesFaced(taskItem.hurdlesFaced || '');
  };

  // Save Edit Task Changes
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const parent = editingTask.parentAlloc;
      const clientObj = clients.find(c => c.id === editClientId);
      const clientName = clientObj ? clientObj.name : (editingTask.clientName || 'Client');

      if (editingTask.isLegacy || !parent.tasks) {
        // Legacy allocation doc
        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', editingTask.allocationId), {
          clientId: editClientId,
          clientName: clientName,
          type: editType,
          date: editDate,
          status: editStatus,
          driveUrl: editDriveUrl.trim(),
          mp3Url: editMp3Url.trim(),
          mp4Url: editMp4Url.trim(),
          remark: editRemark.trim(),
          workDoneDetails: editWorkDoneDetails.trim(),
          hurdlesFaced: editHurdlesFaced.trim(),
          archived: editStatus === 'completed'
        });
      } else {
        // Multi-task allocation doc
        const updatedTasks = [...parent.tasks];
        updatedTasks[editingTask.taskIndex] = {
          ...updatedTasks[editingTask.taskIndex],
          clientId: editClientId,
          clientName: clientName,
          type: editType,
          status: editStatus,
          driveUrl: editDriveUrl.trim(),
          mp3Url: editMp3Url.trim(),
          mp4Url: editMp4Url.trim(),
          remark: editRemark.trim(),
          workDoneDetails: editWorkDoneDetails.trim(),
          hurdlesFaced: editHurdlesFaced.trim()
        };

        const allCompleted = updatedTasks.every(t => t.status === 'completed');

        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', editingTask.allocationId), {
          date: editDate,
          tasks: updatedTasks,
          status: allCompleted ? 'completed' : 'allocated',
          archived: allCompleted
        });
      }

      alert('Task allocation updated successfully!');
      setEditingTask(null);
    } catch (err) {
      console.error('Update allocation error:', err);
      alert('Failed to update task allocation.');
    }
  };

  // Download logic 1: Excel using XML template that preserves CSS color styling (highly requested)
  const downloadColorExcel = () => {
    if (flatTasks.length === 0) {
      alert('No data available to export.');
      return;
    }

    // Generate Excel filename based on filters
    let prefix = 'Work_Allocation';
    if (filterType === 'client' && selectedClientId !== 'all') {
      const c = clients.find(cl => cl.id === selectedClientId);
      prefix += `_Client_${c?.name.replace(/\s+/g, '_')}`;
    } else if (filterType === 'employee' && selectedEmpId !== 'all') {
      const e = employees.find(emp => emp.id === selectedEmpId);
      prefix += `_Emp_${e?.name.replace(/\s+/g, '_')}`;
    }
    prefix += `_${dateRangeType}_${referenceDate}`;

    // Build styled HTML table string
    let tableRows = '';
    flatTasks.forEach((taskItem) => {
      const hex = taskItem.employeeColor || '#ffffff';
      const refUrls = taskItem.urls && taskItem.urls.length > 0 ? taskItem.urls.join(', ') : 'N/A';
      const dLink = taskItem.driveUrl || 'N/A';
      const mp3Lnk = taskItem.mp3Url || 'N/A';
      const mp4Lnk = taskItem.mp4Url || 'N/A';
      
      const statusText = taskItem.status.charAt(0).toUpperCase() + taskItem.status.slice(1);
      const imgHtml = taskItem.image 
        ? `<td style="border: 1px solid #dddddd; padding: 5px; text-align: center; vertical-align: middle;"><img src="${taskItem.image}" width="40" height="40" style="display:block; max-width:40px; max-height:40px; margin: 0 auto;" /></td>`
        : `<td style="border: 1px solid #dddddd; padding: 10px 8px; color: #777777; font-style: italic; text-align: center; vertical-align: middle;">No File</td>`;
      
      tableRows += `
        <tr style="background-color: ${hex}; height: 48px;">
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; font-weight: 500; height: 48px; vertical-align: middle;">${taskItem.employeeName}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${taskItem.clientName}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; text-transform: capitalize; height: 48px; vertical-align: middle;">${taskItem.type}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${taskItem.date}</td>
          ${imgHtml}
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${refUrls}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${dLink}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${mp3Lnk}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${mp4Lnk}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${taskItem.remark || 'N/A'}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 48px; vertical-align: middle;">${statusText}</td>
        </tr>
      `;
    });

    const htmlString = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Work Allocations</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
          th { background-color: #312e81; color: #ffffff; border: 1px solid #cccccc; padding: 12px 10px; font-weight: bold; text-align: left; height: 36px; vertical-align: middle; }
          td { vertical-align: middle; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            <col width="160" />
            <col width="160" />
            <col width="120" />
            <col width="130" />
            <col width="100" />
            <col width="280" />
            <col width="280" />
            <col width="240" />
            <col width="240" />
            <col width="240" />
            <col width="130" />
          </colgroup>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Client Name</th>
              <th>Work Type</th>
              <th>Allocation Date</th>
              <th>File Upload</th>
              <th>Reference URLs</th>
              <th>Google Drive Link</th>
              <th>MP3 Link</th>
              <th>MP4 Link</th>
              <th>Remarks</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${prefix}_ColorCoded.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download logic 2: Clean standard XLSX using SheetJS
  const downloadStandardExcel = () => {
    if (flatTasks.length === 0) {
      alert('No data available to export.');
      return;
    }

    const dataToExport = flatTasks.map(taskItem => ({
      'Employee Name': taskItem.employeeName,
      'Client Name': taskItem.clientName,
      'Work Type': taskItem.type.toUpperCase(),
      'Allocation Date': taskItem.date,
      'File Upload': taskItem.image ? 'Yes (Base64)' : 'No File',
      'Reference URLs': taskItem.urls && taskItem.urls.length > 0 ? taskItem.urls.join(', ') : 'N/A',
      'Google Drive Link': taskItem.driveUrl || 'N/A',
      'MP3 Link': taskItem.mp3Url || 'N/A',
      'MP4 Link': taskItem.mp4Url || 'N/A',
      'Remarks': taskItem.remark || 'N/A',
      'Status': taskItem.status.charAt(0).toUpperCase() + taskItem.status.slice(1),
      'Created At': taskItem.createdAt ? new Date(taskItem.createdAt).toLocaleString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Dynamic column width calculations
    const cols = [];
    const keys = Object.keys(dataToExport[0] || {});
    keys.forEach((key) => {
      let maxLength = key.length;
      dataToExport.forEach((row) => {
        const val = row[key];
        if (val !== undefined && val !== null) {
          const strVal = String(val);
          if (strVal.length > maxLength) {
            maxLength = strVal.length;
          }
        }
      });
      cols.push({ wch: Math.max(maxLength + 4, 15) });
    });
    worksheet['!cols'] = cols;

    // Set row heights to give comfortable vertical spacing
    const rows = [
      { hpt: 28 }, // Header row
      ...dataToExport.map(() => ({ hpt: 22 })) // Data rows
    ];
    worksheet['!rows'] = rows;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Allocations');

    let filename = 'Work_Allocation';
    if (filterType === 'client' && selectedClientId !== 'all') {
      const c = clients.find(cl => cl.id === selectedClientId);
      filename += `_Client_${c?.name.replace(/\s+/g, '_')}`;
    } else if (filterType === 'employee' && selectedEmpId !== 'all') {
      const e = employees.find(emp => emp.id === selectedEmpId);
      filename += `_Emp_${e?.name.replace(/\s+/g, '_')}`;
    }
    filename += `_${dateRangeType}_${referenceDate}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  // Download logic 3: Share report directly to WhatsApp
  const shareOnWhatsApp = async () => {
    if (flatTasks.length === 0) {
      alert('No data available to share.');
      return;
    }

    let message = '';
    let firstImageToCopy = null;

    flatTasks.forEach((taskItem, index) => {
      const resolvedStatus = taskItem.status.charAt(0).toUpperCase() + taskItem.status.slice(1);
      const refUrls = taskItem.urls && taskItem.urls.length > 0 
        ? taskItem.urls.join(', ') 
        : 'N/A';
        
      if (flatTasks.length > 1) {
        message += `*Task ${index + 1}:*\n`;
      }
      message += `• *Client:* ${taskItem.clientName}\n`;
      message += `• *Work Type:* ${taskItem.type.toUpperCase()}\n`;
      message += `• *Scheduled Date:* ${taskItem.date}\n`;
      message += `• *Status:* ${resolvedStatus}\n`;
      if (taskItem.driveUrl) {
        message += `• *Google Drive Link:* ${taskItem.driveUrl}\n`;
      }
      if (taskItem.mp3Url) {
        message += `• *MP3 Link:* ${taskItem.mp3Url}\n`;
      }
      if (taskItem.mp4Url) {
        message += `• *MP4 Link:* ${taskItem.mp4Url}\n`;
      }
      if (refUrls && refUrls !== 'N/A') {
        message += `• *Reference URLs:* ${refUrls}\n`;
      }
      if (taskItem.remark) {
        message += `• *Remarks:* ${taskItem.remark}\n`;
      }
      if (taskItem.image) {
        message += `• *File:* [Copied to clipboard - Paste (Ctrl+V) in chat]\n`;
        if (!firstImageToCopy) {
          firstImageToCopy = taskItem.image;
        }
      }
      message += `-----------------------------------------\n\n`;
    });

    if (firstImageToCopy) {
      try {
        const response = await fetch(firstImageToCopy);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        alert('Image has been copied to your clipboard! Paste it (Ctrl+V) in the WhatsApp window.');
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareTaskOnWhatsApp = async (taskItem) => {
    const resolvedStatus = taskItem.status.charAt(0).toUpperCase() + taskItem.status.slice(1);
    const refUrls = taskItem.urls && taskItem.urls.length > 0 ? taskItem.urls.join(', ') : 'N/A';

    let message = '';
    message += `• *Client:* ${taskItem.clientName}\n`;
    message += `• *Work Type:* ${taskItem.type.toUpperCase()}\n`;
    message += `• *Scheduled Date:* ${taskItem.date}\n`;
    message += `• *Status:* ${resolvedStatus}\n`;
    if (taskItem.driveUrl) {
      message += `• *Google Drive Link:* ${taskItem.driveUrl}\n`;
    }
    if (taskItem.mp3Url) {
      message += `• *MP3 Link:* ${taskItem.mp3Url}\n`;
    }
    if (taskItem.mp4Url) {
      message += `• *MP4 Link:* ${taskItem.mp4Url}\n`;
    }
    if (refUrls && refUrls !== 'N/A') {
      message += `• *Reference URLs:* ${refUrls}\n`;
    }
    if (taskItem.remark) {
      message += `• *Remarks:* ${taskItem.remark}\n`;
    }
    if (taskItem.image) {
      message += `• *File:* [Copied to clipboard - Paste (Ctrl+V) in chat]\n`;
    }
    message += `-----------------------------------------\n\n`;

    if (taskItem.image) {
      try {
        const response = await fetch(taskItem.image);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        alert('Image has been copied to your clipboard! Paste it (Ctrl+V) in the WhatsApp window.');
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  // Delete a single entry/task
  const handleDeleteTask = async (taskItem) => {
    if (!window.confirm(`Are you sure you want to delete the entry for "${taskItem.clientName}" (${taskItem.employeeName})?`)) {
      return;
    }

    try {
      const parent = taskItem.parentAlloc;
      if (taskItem.isLegacy || !parent.tasks || parent.tasks.length <= 1) {
        await deleteDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId));
      } else {
        const updatedTasks = parent.tasks.filter((_, idx) => idx !== taskItem.taskIndex);
        const allCompleted = updatedTasks.length > 0 && updatedTasks.every(t => t.status === 'completed');
        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId), {
          tasks: updatedTasks,
          status: allCompleted ? 'completed' : 'allocated',
          archived: allCompleted
        });
      }
    } catch (err) {
      console.error('Delete task error:', err);
      alert('Failed to delete entry.');
    }
  };

  // Delete all completed entries in current filtered view
  const handleDeleteCompleted = async () => {
    const completedTasks = flatTasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) {
      alert('No completed entries found in the current view.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete all ${completedTasks.length} completed entries in the current view? This action cannot be undone.`)) {
      return;
    }

    try {
      const tasksByAlloc = {};
      completedTasks.forEach(task => {
        if (!tasksByAlloc[task.allocationId]) {
          tasksByAlloc[task.allocationId] = [];
        }
        tasksByAlloc[task.allocationId].push(task);
      });

      for (const [allocId, tasksToDelete] of Object.entries(tasksByAlloc)) {
        const parent = tasksToDelete[0].parentAlloc;
        if (tasksToDelete[0].isLegacy || !parent.tasks) {
          await deleteDoc(doc(db, 'content_reports', 'data', 'allocations', allocId));
        } else {
          const deleteIndices = new Set(tasksToDelete.map(t => t.taskIndex));
          const remainingTasks = parent.tasks.filter((_, idx) => !deleteIndices.has(idx));
          if (remainingTasks.length === 0) {
            await deleteDoc(doc(db, 'content_reports', 'data', 'allocations', allocId));
          } else {
            const allCompleted = remainingTasks.length > 0 && remainingTasks.every(t => t.status === 'completed');
            await updateDoc(doc(db, 'content_reports', 'data', 'allocations', allocId), {
              tasks: remainingTasks,
              status: allCompleted ? 'completed' : 'allocated',
              archived: allCompleted
            });
          }
        }
      }
      alert(`Successfully deleted ${completedTasks.length} completed entries.`);
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Failed to delete completed entries.');
    }
  };

  const uniqueEmployeeCount = [...new Set(flatTasks.map(a => a.employeeId))].length;
  const uniqueClientCount = [...new Set(flatTasks.map(a => a.clientId))].length;

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Reports & Exports
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Filter allocation history by client, employee, and time ranges. Download color-coded sheets directly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* FILTER SELECTIONS SIDEBAR */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 h-fit shadow-sm">
          <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
            <Filter className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Report Filters</h2>
          </div>

          {/* Tab switches for Filter Mode */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Filter Target
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => {
                    setFilterType('client');
                    setSelectedEmpId('all');
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    filterType === 'client' 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  By Client
                </button>
                <button
                  onClick={() => {
                    setFilterType('employee');
                    setSelectedClientId('all');
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    filterType === 'employee' 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  By Employee
                </button>
              </div>
            </div>

            {/* Dynamic Select Dropdowns */}
            {filterType === 'client' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="all">All Clients</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Employee
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
            )}

            {/* Date Range Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Date Range Filter
              </label>
              <select
                value={dateRangeType}
                onChange={(e) => setDateRangeType(e.target.value)}
                className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 mb-3"
              >
                <option value="all">All Time History</option>
                <option value="daily">Daily View</option>
                <option value="weekly">Weekly View</option>
                <option value="monthly">Monthly View</option>
              </select>
              
              {dateRangeType !== 'all' && (
                <div>
                  <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                    Reference Date Picker
                  </label>
                  <input
                    type="date"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DATA PREVIEW & EXPORT ACTIONS */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col space-y-6 shadow-sm">
          {/* Header block with Preview details and export buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Report Preview ({flatTasks.length} tasks)</h2>
              <p className="text-slate-500 text-xs mt-0.5">Previewing matching allocations (including archives).</p>
            </div>

            {/* Download Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadColorExcel}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2 px-3 rounded-xl text-xs transition shadow-md shadow-emerald-700/10 cursor-pointer"
                title="Download spreadsheet retaining color categories assigned to employees"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Color XLS</span>
              </button>
              <button
                onClick={downloadStandardExcel}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Download standard clean XLSX spreadsheet"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Standard XLSX</span>
              </button>
              <button
                onClick={shareOnWhatsApp}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Share this full report on WhatsApp"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Report</span>
              </button>
              <button
                onClick={handleDeleteCompleted}
                className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-3 rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Delete all completed entries in current view"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Completed</span>
              </button>
            </div>
          </div>

          {/* REPORT PREVIEW CONTAINER - Viewable and exported directly */}
          <div id="report-preview-table-container" className="bg-white rounded-xl p-4 border border-slate-100 flex flex-col space-y-5 shadow-xs">
            {/* Header branding visible in exports */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3.5 border-b border-slate-100 gap-2">
              <div>
                <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest">System Generated Report</span>
                <h3 className="text-base font-black text-slate-800 tracking-tight">Work Allocation Overview</h3>
                <p className="text-slate-500 text-xs mt-0.5 font-medium">
                  {filterType === 'client' 
                    ? `Client Target: ${selectedClientId === 'all' ? 'All Clients' : clients.find(c => c.id === selectedClientId)?.name || ''}`
                    : `Employee Target: ${selectedEmpId === 'all' ? 'All Employees' : employees.find(e => e.id === selectedEmpId)?.name || ''}`}
                  {` • Scope: ${dateRangeType.toUpperCase()} (${referenceDate})`}
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Generated On</span>
                <span className="text-xs font-semibold text-slate-600 font-mono">{new Date().toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}</span>
              </div>
            </div>

            {/* Quick Statistics Row */}
            <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-center">
              <div>
                <span className="block text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Tasks</span>
                <span className="text-lg sm:text-xl font-black text-slate-800">{flatTasks.length}</span>
              </div>
              <div className="border-x border-slate-200">
                <span className="block text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Employees</span>
                <span className="text-lg sm:text-xl font-black text-indigo-600">{uniqueEmployeeCount}</span>
              </div>
              <div>
                <span className="block text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Clients</span>
                <span className="text-lg sm:text-xl font-black text-emerald-600">{uniqueClientCount}</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50/50">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Scheduled Date</th>
                    <th className="p-3">Links & Drive</th>
                    <th className="p-3">Remarks & Reasons</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Review</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-slate-700">
                  {flatTasks.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-12 text-slate-400">
                        No matching records found.
                      </td>
                    </tr>
                  ) : (
                    flatTasks.map((taskItem) => (
                      <tr 
                        key={taskItem.id} 
                        className="hover:bg-slate-50/50 transition duration-150"
                      >
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            {taskItem.employeePhoto ? (
                              <img src={taskItem.employeePhoto} alt={taskItem.employeeName} className="h-6 w-6 rounded-full object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <span 
                                className="inline-block w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                                style={{ backgroundColor: taskItem.employeeColor }}
                              />
                            )}
                            <span className="font-semibold text-slate-800">{taskItem.employeeName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {taskItem.clientName}
                        </td>
                        <td className="p-3 text-xs capitalize">
                          <span className={`inline-flex px-2 py-0.5 font-medium rounded-full capitalize ${getPostTypeBadgeStyle(taskItem.type)}`}>
                            {taskItem.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-500 font-semibold">
                          {taskItem.date}
                        </td>
                        <td className="p-3 text-xs">
                          <div className="flex flex-col space-y-1">
                            {/* Render Task Image Thumbnail */}
                            {taskItem.image && (
                              <div className="mb-1 w-fit">
                                <img 
                                  src={taskItem.image} 
                                  alt="Task" 
                                  className="h-8 w-8 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition"
                                  onClick={() => setViewImageSrc(taskItem.image)}
                                  title="Click to view image"
                                />
                              </div>
                            )}
                            {/* Render Google Drive Link */}
                            {taskItem.driveUrl && (
                              <a 
                                href={taskItem.driveUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-emerald-700 hover:text-emerald-800 hover:underline font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 w-fit"
                              >
                                <span>Drive Link</span>
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                            {/* Render MP3 Link */}
                            {taskItem.mp3Url && (
                              <a 
                                href={taskItem.mp3Url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-amber-700 hover:text-amber-800 hover:underline font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit"
                              >
                                <Music className="h-3 w-3 mr-1" />
                                <span>MP3 Link</span>
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                            {/* Render MP4 Link */}
                            {taskItem.mp4Url && (
                              <a 
                                href={taskItem.mp4Url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-rose-700 hover:text-rose-800 hover:underline font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 w-fit"
                              >
                                <Video className="h-3 w-3 mr-1" />
                                <span>MP4 Link</span>
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                            {/* Render Reference URLs */}
                            {(() => {
                              if (!taskItem.urls || taskItem.urls.length === 0) {
                                return !taskItem.driveUrl && <span className="text-slate-400 italic">No links</span>;
                              }
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {taskItem.urls.map((lnk, idx) => (
                                    <a 
                                      key={idx}
                                      href={lnk} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-indigo-700 hover:text-indigo-800 hover:underline font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                                    >
                                      <span>Ref {taskItem.urls.length > 1 ? idx + 1 : ''}</span>
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="p-3 max-w-xs text-slate-600">
                          <div className="space-y-1 text-xs">
                            {taskItem.remark && <p className="truncate text-slate-700" title={taskItem.remark}><span className="font-semibold text-slate-500">Alloc:</span> {taskItem.remark}</p>}
                            
                            {taskItem.workDoneDetails && (
                              <div className="bg-indigo-50/80 border border-indigo-100 p-1.5 rounded-lg text-xs space-y-0.5">
                                <span className="font-bold text-indigo-900 block text-[10px]">📝 Work Done:</span>
                                <p className="text-slate-700 font-medium truncate" title={taskItem.workDoneDetails}>{taskItem.workDoneDetails}</p>
                              </div>
                            )}

                            {taskItem.hurdlesFaced && (
                              <div className="bg-amber-50 border border-amber-200 p-1.5 rounded-lg text-xs space-y-0.5">
                                <span className="font-bold text-amber-900 block text-[10px]">⚠️ Hurdles Faced:</span>
                                <p className="text-amber-800 font-medium truncate" title={taskItem.hurdlesFaced}>{taskItem.hurdlesFaced}</p>
                              </div>
                            )}

                            {taskItem.reasonIncompleted && !taskItem.hurdlesFaced && (
                              <p className="text-xs text-rose-700 font-semibold bg-rose-50 p-1.5 rounded border border-rose-200" title={taskItem.reasonIncompleted}>
                                Incompleted: {taskItem.reasonIncompleted}
                              </p>
                            )}

                            {(taskItem.workDoneDetails || taskItem.hurdlesFaced) && (
                              <button
                                onClick={() => setViewReportTask(taskItem)}
                                className="inline-flex items-center space-x-1 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer pt-0.5"
                              >
                                <span>Full Report & Hurdles</span>
                              </button>
                            )}

                            {!taskItem.remark && !taskItem.workDoneDetails && !taskItem.hurdlesFaced && !taskItem.reasonIncompleted && (
                              <span className="text-slate-400 italic text-xs">No details</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <select
                            value={taskItem.status}
                            onChange={async (e) => {
                              try {
                                const nextStatus = e.target.value;
                                const parent = taskItem.parentAlloc;

                                if (taskItem.isLegacy) {
                                  await updateDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId), {
                                    status: nextStatus,
                                    archived: nextStatus === 'completed'
                                  });
                                } else {
                                  const updatedTasks = [...parent.tasks];
                                  updatedTasks[taskItem.taskIndex].status = nextStatus;

                                  const allCompleted = updatedTasks.every(t => t.status === 'completed');

                                  await updateDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId), {
                                    tasks: updatedTasks,
                                    status: allCompleted ? 'completed' : 'allocated',
                                    archived: allCompleted
                                  });
                                }
                              } catch (err) {
                                console.error(err);
                                alert('Failed to update status.');
                              }
                            }}
                            className={`status-select inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer border transition duration-150 focus:outline-none focus:ring-1 focus:ring-slate-300 ${
                              taskItem.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              taskItem.status === 'incompleted' ? 'bg-red-50 text-red-750 border-red-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            <option value="allocated" className="bg-white text-slate-800">Allocated</option>
                            <option value="completed" className="bg-white text-slate-800">Completed</option>
                            <option value="incompleted" className="bg-white text-slate-800">Incompleted</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center space-y-1">
                            {taskItem.approvalStatus === 'approved' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="h-3 w-3 mr-1" /> Approved
                              </span>
                            ) : taskItem.approvalStatus === 'disapproved' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200" title={taskItem.approvalRemark || 'Disapproved'}>
                                <AlertCircle className="h-3 w-3 mr-1" /> Disapproved
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Pending
                              </span>
                            )}

                            <div className="flex items-center space-x-1 pt-0.5">
                              <button
                                onClick={async () => {
                                  try {
                                    const parent = taskItem.parentAlloc;
                                    if (taskItem.isLegacy) {
                                      await updateDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId), {
                                        approvalStatus: 'approved',
                                        approvalRemark: ''
                                      });
                                    } else {
                                      const updatedTasks = [...parent.tasks];
                                      updatedTasks[taskItem.taskIndex].approvalStatus = 'approved';
                                      updatedTasks[taskItem.taskIndex].approvalRemark = '';
                                      await updateDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId), {
                                        tasks: updatedTasks
                                      });
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    alert('Failed to approve task.');
                                  }
                                }}
                                className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded transition cursor-pointer"
                                title="Approve Employee Submission"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              {taskItem.status !== 'completed' && taskItem.approvalStatus !== 'approved' && (
                                <button
                                  onClick={async () => {
                                    const remark = window.prompt('Enter disapproval reason for employee:');
                                    if (remark === null) return;
                                    try {
                                      const parent = taskItem.parentAlloc;
                                      if (taskItem.isLegacy) {
                                        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId), {
                                          approvalStatus: 'disapproved',
                                          approvalRemark: remark.trim()
                                        });
                                      } else {
                                        const updatedTasks = [...parent.tasks];
                                        updatedTasks[taskItem.taskIndex].approvalStatus = 'disapproved';
                                        updatedTasks[taskItem.taskIndex].approvalRemark = remark.trim();
                                        await updateDoc(doc(db, 'content_reports', 'data', 'allocations', taskItem.allocationId), {
                                          tasks: updatedTasks
                                        });
                                      }
                                    } catch (err) {
                                      console.error(err);
                                      alert('Failed to disapprove task.');
                                    }
                                  }}
                                  className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded transition cursor-pointer"
                                  title="Disapprove Employee Submission"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEdit(taskItem)}
                              className="inline-flex items-center justify-center p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition duration-150 shadow-xs cursor-pointer"
                              title="Edit Task Allocation"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => shareTaskOnWhatsApp(taskItem)}
                              className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-lg transition duration-150 shadow-xs cursor-pointer"
                              title="Share this task on WhatsApp"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            
                            {/* Hide Delete Cross Button permanently if task is marked Completed (until Allocator edits it) */}
                            {taskItem.status !== 'completed' && (
                              <button
                                onClick={() => handleDeleteTask(taskItem)}
                                className="inline-flex items-center justify-center p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition duration-150 shadow-xs cursor-pointer"
                                title="Delete this entry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
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
      </div>

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
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 px-2">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(viewImageSrc);
                    const blob = await response.blob();
                    await navigator.clipboard.write([
                      new ClipboardItem({ [blob.type]: blob })
                    ]);
                    alert('Image copied to clipboard! You can paste (Ctrl+V) it directly into WhatsApp.');
                  } catch (err) {
                    console.error('Clipboard copy failed:', err);
                    alert('Failed to copy image to clipboard.');
                  }
                }}
                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-100 transition flex items-center space-x-1 cursor-pointer"
              >
                <span>Copy Image</span>
              </button>
              <a 
                href={viewImageSrc} 
                download="work_allocation_image.jpg"
                className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-emerald-100 transition flex items-center space-x-1 cursor-pointer"
              >
                <span>Download Image</span>
              </a>
            </div>
          </div>
        </div>
      )}
      {/* VIEW WORK DETAILS & HURDLES MODAL FOR ALLOCATOR */}
      {viewReportTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setViewReportTask(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full relative max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewReportTask(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <CheckCircle className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Employee Work Report & Hurdles</h3>
                <p className="text-xs text-slate-500">{viewReportTask.employeeName} • {viewReportTask.clientName} ({viewReportTask.type})</p>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-slate-700 text-xs">
              {/* Task Meta Card */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Allocation Date</span>
                  <span className="font-semibold text-slate-900">{viewReportTask.date}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Work Status</span>
                  <span className="font-extrabold text-emerald-700 capitalize">{viewReportTask.status}</span>
                </div>
              </div>

              {/* Work Done Details */}
              {viewReportTask.workDoneDetails ? (
                <div className="bg-indigo-50/70 border border-indigo-200/80 p-4 rounded-xl space-y-1.5">
                  <span className="font-bold text-indigo-900 text-xs uppercase tracking-wider flex items-center">
                    📝 Work Done Details Submitted by Employee:
                  </span>
                  <p className="text-slate-800 leading-relaxed text-xs whitespace-pre-wrap">{viewReportTask.workDoneDetails}</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-xl text-slate-400 italic">No work done details recorded.</div>
              )}

              {/* Hurdles & Difficulties */}
              {viewReportTask.hurdlesFaced ? (
                <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-xl space-y-1.5">
                  <span className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center">
                    ⚠️ Hurdles / Difficulties Faced During Work:
                  </span>
                  <p className="text-amber-900 leading-relaxed text-xs whitespace-pre-wrap">{viewReportTask.hurdlesFaced}</p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl text-emerald-800 text-xs font-semibold">
                  ✓ No hurdles or difficulties reported for this task.
                </div>
              )}

              {/* Allocator Remark if any */}
              {viewReportTask.remark && (
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600 block text-[10px] uppercase">Your Allocator Remark:</span>
                  <p className="text-slate-800">{viewReportTask.remark}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewReportTask(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
      {/* EDIT TASK ALLOCATION MODAL */}
      {editingTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setEditingTask(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setEditingTask(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Edit3 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Task Allocation</h3>
                <p className="text-xs text-slate-500">Employee: {editingTask.employeeName}</p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Select Client
                  </label>
                  <select
                    value={editClientId}
                    onChange={(e) => setEditClientId(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">-- Select Client --</option>
                    {clients.map(cl => (
                      <option key={cl.id} value={cl.id}>{cl.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Work / Post Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
                  >
                    <option value="story">Story</option>
                    <option value="reel">Reel</option>
                    <option value="post">Post</option>
                    <option value="pdf">PDF</option>
                    <option value="banner/flyer">Banner/Flyer</option>
                    <option value="printable">Printable</option>
                    <option value="logo/vector">Logo/Vector</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Work Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="allocated">Allocated</option>
                    <option value="completed">Completed</option>
                    <option value="incompleted">Incompleted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Google Drive Link (Optional)
                </label>
                <input
                  type="url"
                  value={editDriveUrl}
                  onChange={(e) => setEditDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    MP3 Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={editMp3Url}
                    onChange={(e) => setEditMp3Url(e.target.value)}
                    placeholder="https://..."
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    MP4 Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={editMp4Url}
                    onChange={(e) => setEditMp4Url(e.target.value)}
                    placeholder="https://..."
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Allocator Remark / Instructions
                </label>
                <textarea
                  rows="2"
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  placeholder="Instructions for employee..."
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-indigo-900 uppercase tracking-wider mb-1">
                  Employee Work Done Details
                </label>
                <textarea
                  rows="2"
                  value={editWorkDoneDetails}
                  onChange={(e) => setEditWorkDoneDetails(e.target.value)}
                  placeholder="Work done notes..."
                  className="block w-full px-3 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-amber-900 uppercase tracking-wider mb-1">
                  Employee Hurdles / Difficulties Faced
                </label>
                <textarea
                  rows="2"
                  value={editHurdlesFaced}
                  onChange={(e) => setEditHurdlesFaced(e.target.value)}
                  placeholder="Hurdles faced..."
                  className="block w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-amber-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
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
