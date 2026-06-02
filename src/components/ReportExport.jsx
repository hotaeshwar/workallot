import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Filter, Calendar, Users, Briefcase, 
  Download, RefreshCw, Layers, ExternalLink, Share2
} from 'lucide-react';

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

  const [filteredData, setFilteredData] = useState([]);
  const [flatTasks, setFlatTasks] = useState([]);
  const [loading, setLoading] = useState(false);

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
  useEffect(() => {
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

    setFilteredData(result);
  }, [allocations, filterType, selectedClientId, selectedEmpId, dateRangeType, referenceDate]);

  // Map allocations down to individual tasks
  useEffect(() => {
    const tasksList = [];
    filteredData.forEach(alloc => {
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
            clientId: tClientId,
            clientName: tClientName,
            date: alloc.date,
            createdAt: alloc.createdAt,
            archived: alloc.archived,
            taskIndex: index,
            type: t.type,
            urls: t.urls || [],
            driveUrl: t.driveUrl || '',
            remark: t.remark || '',
            status: t.status || 'allocated',
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
          clientId: tClientId,
          clientName: tClientName,
          date: alloc.date,
          createdAt: alloc.createdAt,
          archived: alloc.archived,
          taskIndex: -1,
          type: alloc.type || 'story',
          urls: alloc.urls || (alloc.url ? [alloc.url] : []),
          driveUrl: alloc.driveUrl || '',
          remark: alloc.remark || '',
          status: alloc.status || 'allocated',
          isLegacy: true,
          parentAlloc: alloc
        });
      }
    });
    setFlatTasks(tasksList);
  }, [filteredData, filterType, selectedClientId]);

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
      
      const statusText = taskItem.status.charAt(0).toUpperCase() + taskItem.status.slice(1);
      
      tableRows += `
        <tr style="background-color: ${hex}; height: 28px;">
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; font-weight: 500; height: 28px; vertical-align: middle;">${taskItem.employeeName}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 28px; vertical-align: middle;">${taskItem.clientName}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; text-transform: capitalize; height: 28px; vertical-align: middle;">${taskItem.type}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 28px; vertical-align: middle;">${taskItem.date}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 28px; vertical-align: middle;">${refUrls}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 28px; vertical-align: middle;">${dLink}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 28px; vertical-align: middle;">${taskItem.remark || 'N/A'}</td>
          <td style="border: 1px solid #dddddd; padding: 10px 8px; color: #000000; height: 28px; vertical-align: middle;">${statusText}</td>
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
            <col width="280" />
            <col width="280" />
            <col width="240" />
            <col width="130" />
          </</colgroup>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Client Name</th>
              <th>Work Type</th>
              <th>Allocation Date</th>
              <th>Reference URLs</th>
              <th>Google Drive Link</th>
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
      'Reference URLs': taskItem.urls && taskItem.urls.length > 0 ? taskItem.urls.join(', ') : 'N/A',
      'Google Drive Link': taskItem.driveUrl || 'N/A',
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
  const shareOnWhatsApp = () => {
    if (flatTasks.length === 0) {
      alert('No data available to share.');
      return;
    }

    let message = '';
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
      if (refUrls && refUrls !== 'N/A') {
        message += `• *Reference URLs:* ${refUrls}\n`;
      }
      if (taskItem.remark) {
        message += `• *Remarks:* ${taskItem.remark}\n`;
      }
      message += `-----------------------------------------\n\n`;
    });

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareTaskOnWhatsApp = (taskItem) => {
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
    if (refUrls && refUrls !== 'N/A') {
      message += `• *Reference URLs:* ${refUrls}\n`;
    }
    if (taskItem.remark) {
      message += `• *Remarks:* ${taskItem.remark}\n`;
    }
    message += `-----------------------------------------\n\n`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
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
                    <th className="p-3">Remarks</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-slate-700">
                  {flatTasks.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400">
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
                            <span 
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                              style={{ backgroundColor: taskItem.employeeColor }}
                            />
                            <span className="font-semibold text-slate-800">{taskItem.employeeName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {taskItem.clientName}
                        </td>
                        <td className="p-3 text-xs capitalize">
                          <span className={`inline-flex px-2 py-0.5 font-medium rounded-full ${
                            taskItem.type === 'story' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                            taskItem.type === 'reel' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                            'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}>
                            {taskItem.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-500 font-semibold">
                          {taskItem.date}
                        </td>
                        <td className="p-3 text-xs">
                          <div className="flex flex-col space-y-1">
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
                        <td className="p-3 max-w-xs truncate text-slate-500" title={taskItem.remark}>
                          {taskItem.remark || <span className="text-slate-400 italic">No remarks</span>}
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
                          <button
                            onClick={() => shareTaskOnWhatsApp(taskItem)}
                            className="inline-flex items-center justify-center p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-lg transition duration-150 shadow-xs cursor-pointer"
                            title={`Share this task on WhatsApp`}
                          >
                            <Share2 className="h-3.5 w-3.5" />
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
    </div>
  );
}
