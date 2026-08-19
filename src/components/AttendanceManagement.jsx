import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Clock, Filter, Download, Trash2, Calendar, User, FileSpreadsheet } from 'lucide-react';

export default function AttendanceManagement({ isGuestMode = false }) {
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or 'YYYY-MM'

  useEffect(() => {
    // Fetch Employees
    const unsubEmp = onSnapshot(collection(db, 'content_reports', 'data', 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Attendance
    const unsubAtt = onSnapshot(collection(db, 'content_reports', 'data', 'attendance'), (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const nowMs = new Date().getTime();
      const limitMs = 8 * 60 * 60 * 1000;

      records.forEach(rec => {
        if (rec.status === 'clocked_in' && rec.clockInIso) {
          const startMs = new Date(rec.clockInIso).getTime();
          if (nowMs - startMs > limitMs) {
            const autoClockOutDate = new Date(startMs + limitMs);
            const timeStr = autoClockOutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            updateDoc(doc(db, 'content_reports', 'data', 'attendance', rec.id), {
              clockOutTime: timeStr,
              clockOutIso: autoClockOutDate.toISOString(),
              workDurationMinutes: 480, // 8 hours
              status: 'completed',
              autoClockedOut: true
            }).catch(err => console.error("Auto clock-out error:", err));
          }
        }
      });

      records.sort((a, b) => new Date(b.clockInIso || b.date) - new Date(a.clockInIso || a.date));
      setAttendanceRecords(records);
    });

    return () => {
      unsubEmp();
      unsubAtt();
    };
  }, []);

  // Filter attendance records
  const filteredRecords = useMemo(() => {
    let result = [...attendanceRecords];

    if (selectedEmpId !== 'all') {
      result = result.filter(r => r.employeeId === selectedEmpId);
    }

    if (selectedMonth !== 'all') {
      result = result.filter(r => (r.date || '').startsWith(selectedMonth));
    }

    return result;
  }, [attendanceRecords, selectedEmpId, selectedMonth]);

  // Extract unique available months (YYYY-MM)
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    attendanceRecords.forEach(r => {
      if (r.date && r.date.length >= 7) {
        monthsSet.add(r.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [attendanceRecords]);

  // Export Monthly Attendance Excel with separate sheets for each month
  const downloadMonthlyAttendanceExcel = () => {
    if (attendanceRecords.length === 0) {
      alert('No attendance data available to export.');
      return;
    }

    // Filter by employee if selected
    let targetRecords = [...attendanceRecords];
    if (selectedEmpId !== 'all') {
      targetRecords = targetRecords.filter(r => r.employeeId === selectedEmpId);
    }

    if (targetRecords.length === 0) {
      alert('No records match the selected employee.');
      return;
    }

    // Group records by YYYY-MM
    const monthGroups = {};
    targetRecords.forEach(rec => {
      const monthKey = rec.date ? rec.date.substring(0, 7) : 'Unknown';
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(rec);
    });

    const workbook = XLSX.utils.book_new();

    // Iterate through each month group and add a separate worksheet
    Object.keys(monthGroups).sort().reverse().forEach((monthKey) => {
      const recs = monthGroups[monthKey];

      // Format Sheet Name e.g. "2026-01" -> "Jan 2026"
      let sheetName = monthKey;
      if (monthKey !== 'Unknown' && monthKey.includes('-')) {
        const [year, monthNum] = monthKey.split('-');
        const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        sheetName = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      }

      const rowsToExport = recs.map(rec => {
        const totalMin = rec.workDurationMinutes || 0;
        const hrs = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        const durationStr = totalMin > 0 ? `${hrs}h ${mins}m` : (rec.status === 'clocked_in' ? 'Shift Active' : '0m');
        const decimalHrs = parseFloat((totalMin / 60).toFixed(2));

        return {
          'Employee Name': rec.employeeName || 'Unknown',
          'Date': rec.date || 'N/A',
          'Clock In Time': rec.clockInTime || 'N/A',
          'Clock Out Time': rec.clockOutTime || 'Active Shift',
          'Duration (Minutes)': totalMin,
          'Duration (Hours & Mins)': durationStr,
          'Total Decimal Hours': decimalHrs,
          'Shift Status': rec.status === 'clocked_in' ? 'Clocked In (Active)' : 'Completed'
        };
      });

      // Calculate Employee Monthly Summaries
      const empTotals = {};
      recs.forEach(r => {
        const name = r.employeeName || 'Unknown';
        if (!empTotals[name]) {
          empTotals[name] = { name, totalMins: 0, shiftsCount: 0 };
        }
        empTotals[name].totalMins += (r.workDurationMinutes || 0);
        empTotals[name].shiftsCount += 1;
      });

      // Append blank row and summary header
      rowsToExport.push({
        'Employee Name': '',
        'Date': '',
        'Clock In Time': '',
        'Clock Out Time': '',
        'Duration (Minutes)': '',
        'Duration (Hours & Mins)': '',
        'Total Decimal Hours': '',
        'Shift Status': ''
      });

      rowsToExport.push({
        'Employee Name': '=== MONTHLY WORK HOURS SUMMARY ===',
        'Date': '',
        'Clock In Time': '',
        'Clock Out Time': '',
        'Duration (Minutes)': '',
        'Duration (Hours & Mins)': '',
        'Total Decimal Hours': '',
        'Shift Status': ''
      });

      Object.values(empTotals).forEach(e => {
        const h = Math.floor(e.totalMins / 60);
        const m = e.totalMins % 60;
        const decimalHrs = parseFloat((e.totalMins / 60).toFixed(2));
        rowsToExport.push({
          'Employee Name': e.name,
          'Date': `Total Days Worked: ${e.shiftsCount}`,
          'Clock In Time': '-',
          'Clock Out Time': '-',
          'Duration (Minutes)': e.totalMins,
          'Duration (Hours & Mins)': `${h}h ${m}m`,
          'Total Decimal Hours': decimalHrs,
          'Shift Status': 'MONTHLY TOTAL'
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(rowsToExport);

      // Set explicit generous column widths to prevent Excel text truncation or cell overlap
      worksheet['!cols'] = [
        { wch: 22 }, // Employee Name
        { wch: 20 }, // Date
        { wch: 18 }, // Clock In Time
        { wch: 18 }, // Clock Out Time
        { wch: 22 }, // Duration (Minutes)
        { wch: 24 }, // Duration (Hours & Mins)
        { wch: 22 }, // Total Decimal Hours
        { wch: 22 }  // Shift Status
      ];

      // Append sheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31)); // Max 31 chars for Excel tab name
    });

    let filename = 'Monthly_Attendance_Report';
    if (selectedEmpId !== 'all') {
      const emp = employees.find(e => e.id === selectedEmpId);
      if (emp) {
        filename += `_${emp.name.replace(/\s+/g, '_')}`;
      }
    }
    filename += `.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  const handleDeleteRecord = async (id, name, date) => {
    if (isGuestMode) return;
    if (window.confirm(`Delete attendance record for ${name} on ${date}?`)) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'attendance', id));
      } catch (err) {
        console.error('Delete attendance error:', err);
        alert('Failed to delete attendance record.');
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Attendance & Work Time Management
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Monitor employee shift clock-in/out times, calculate work periods, and export monthly Excel sheets with separate tabs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* FILTERS SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
              <Filter className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Attendance Filters</h2>
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
                  Filter by Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                >
                  <option value="all">All Months</option>
                  {availableMonths.map(m => {
                    const [y, mNum] = m.split('-');
                    const dateObj = new Date(parseInt(y), parseInt(mNum) - 1, 1);
                    const label = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m}>{label}</option>;
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* MONTHLY SUMMARY CARD FOR ALLOCATOR */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Employee Work Hour Totals</span>
              <Clock className="h-4 w-4 text-indigo-600" />
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(() => {
                const empTotalsUI = {};
                filteredRecords.forEach(r => {
                  const name = r.employeeName || 'Unknown';
                  if (!empTotalsUI[name]) {
                    empTotalsUI[name] = 0;
                  }
                  empTotalsUI[name] += (r.workDurationMinutes || 0);
                });

                const entries = Object.entries(empTotalsUI);
                if (entries.length === 0) {
                  return <p className="text-xs text-slate-400 italic">No attendance data for selection.</p>;
                }

                return entries.map(([name, mins]) => {
                  const hrs = (mins / 60).toFixed(1);
                  return (
                    <div key={name} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <span className="font-semibold text-slate-800">{name}</span>
                      <span className="font-extrabold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{hrs} Hours</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* MAIN DATA TABLE & EXPORT BUTTON */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Attendance Records ({filteredRecords.length})</h2>
              <p className="text-xs text-slate-500 mt-0.5">Showing work period logs</p>
            </div>

            <button
              onClick={downloadMonthlyAttendanceExcel}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-emerald-600/10 cursor-pointer"
              title="Download Excel workbook with each month in a separate worksheet tab"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Download Monthly Attendance Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3">Total Work Period</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-400">
                      No attendance records found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const totalMin = rec.workDurationMinutes || 0;
                    const hrs = Math.floor(totalMin / 60);
                    const mins = totalMin % 60;
                    const durationStr = totalMin > 0 ? `${hrs}h ${mins}m` : (rec.status === 'clocked_in' ? 'Shift Active' : '0m');

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{rec.employeeName}</td>
                        <td className="p-3 font-mono font-semibold text-slate-600">{rec.date}</td>
                        <td className="p-3 font-mono text-emerald-700 font-semibold">{rec.clockInTime}</td>
                        <td className="p-3 font-mono text-rose-700 font-semibold">{rec.clockOutTime || 'Active...'}</td>
                        <td className="p-3 font-bold text-slate-800">{durationStr}</td>
                        <td className="p-3 text-center">
                          {rec.status === 'clocked_in' ? (
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Clocked In
                            </span>
                          ) : rec.autoClockedOut ? (
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-amber-100 text-amber-800 border border-amber-200" title="System Auto-Clocked Out after 8 Hours">
                              Auto Clocked Out
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-extrabold rounded bg-slate-100 text-slate-700 border border-slate-200">
                              Completed
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {!isGuestMode ? (
                            <button
                              onClick={() => handleDeleteRecord(rec.id, rec.employeeName, rec.date)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition cursor-pointer"
                              title="Delete attendance record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Read Only</span>
                          )}
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
    </div>
  );
}
