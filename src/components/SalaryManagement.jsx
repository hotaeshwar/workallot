import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { 
  DollarSign, FileText, Printer, Plus, Trash2, Calendar, User, 
  Building2, CheckCircle, Calculator, Download, X, Eye, Edit3, Save 
} from 'lucide-react';

export default function SalaryManagement() {
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [salarySlips, setSalarySlips] = useState([]);

  // Generator Modal state
  const [showGenModal, setShowGenModal] = useState(false);
  const [empId, setEmpId] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [calcMethod, setCalcMethod] = useState('pro_rata_hours'); // 'pro_rata_hours', 'days_worked', 'fixed_shortfall'
  const [baseSalary, setBaseSalary] = useState('');
  const [expectedHours, setExpectedHours] = useState('160');
  const [expectedDays, setExpectedDays] = useState('26');
  const [allowances, setAllowances] = useState('0');
  const [otherDeductions, setOtherDeductions] = useState('0');
  const [remarks, setRemarks] = useState('');

  // Edit Salary Slip Modal state
  const [editingSlip, setEditingSlip] = useState(null);
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editExpectedHours, setEditExpectedHours] = useState('160');
  const [editExpectedDays, setEditExpectedDays] = useState('26');
  const [editAllowances, setEditAllowances] = useState('0');
  const [editOtherDeductions, setEditOtherDeductions] = useState('0');
  const [editRemarks, setEditRemarks] = useState('');

  // Print PDF Modal state
  const [viewSlip, setViewSlip] = useState(null);

  const handlePrintPDF = () => {
    window.print();
  };

  useEffect(() => {
    // 1. Fetch Employees
    const unsubEmp = onSnapshot(collection(db, 'content_reports', 'data', 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch Attendance
    const unsubAtt = onSnapshot(collection(db, 'content_reports', 'data', 'attendance'), (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Fetch Leaves
    const unsubLeaves = onSnapshot(collection(db, 'content_reports', 'data', 'leaves'), (snapshot) => {
      setLeaveRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Fetch Generated Salary Slips
    const qSlips = query(collection(db, 'content_reports', 'data', 'salary_slips'), orderBy('createdAt', 'desc'));
    const unsubSlips = onSnapshot(qSlips, (snapshot) => {
      setSalarySlips(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubEmp();
      unsubAtt();
      unsubLeaves();
      unsubSlips();
    };
  }, []);

  // Calculate stats for selected employee & month during creation
  const selectedEmp = useMemo(() => employees.find(e => e.id === empId), [employees, empId]);

  // Autofill baseSalary from employee record
  useEffect(() => {
    if (selectedEmp && selectedEmp.baseSalary !== undefined && selectedEmp.baseSalary !== null && selectedEmp.baseSalary !== '') {
      setBaseSalary(String(selectedEmp.baseSalary));
    }
  }, [selectedEmp]);

  const monthStats = useMemo(() => {
    if (!empId || !salaryMonth) return { actualHours: 0, daysWorked: 0, leaveDays: 0 };

    // Filter attendance for emp & month
    const empAtt = attendanceRecords.filter(r => r.employeeId === empId && (r.date || '').startsWith(salaryMonth));
    let totalMins = 0;
    empAtt.forEach(r => totalMins += (r.workDurationMinutes || 0));
    const actualHours = (totalMins / 60);

    // Filter leaves for emp & month
    const empLeaves = leaveRecords.filter(l => l.employeeId === empId && (l.startDate || '').startsWith(salaryMonth));
    let leaveDays = empLeaves.length;

    return {
      actualHours: parseFloat(actualHours.toFixed(2)),
      daysWorked: empAtt.length,
      leaveDays
    };
  }, [empId, salaryMonth, attendanceRecords, leaveRecords]);

  // Derived calculation formula
  const calculatedSalary = useMemo(() => {
    const base = parseFloat(baseSalary) || 0;
    const stdHrs = parseFloat(expectedHours) || 160;
    const stdDays = parseFloat(expectedDays) || 26;
    const allow = parseFloat(allowances) || 0;
    const extraDed = parseFloat(otherDeductions) || 0;

    const actualHrs = monthStats.actualHours;
    const actualDays = monthStats.daysWorked;

    let hourlyRate = stdHrs > 0 ? base / stdHrs : 0;
    let dailyRate = stdDays > 0 ? base / stdDays : 0;
    let earnedWorkSalary = 0;
    let workDeduction = 0;

    if (calcMethod === 'pro_rata_hours') {
      // Earned salary based directly on actual shift hours worked
      earnedWorkSalary = actualHrs * hourlyRate;
      workDeduction = Math.max(0, base - earnedWorkSalary);
    } else if (calcMethod === 'days_worked') {
      // Earned salary based directly on actual days worked
      earnedWorkSalary = actualDays * dailyRate;
      workDeduction = Math.max(0, base - earnedWorkSalary);
    } else {
      // Fixed Monthly Salary minus Shortfall
      let hourShortfall = stdHrs - actualHrs;
      if (hourShortfall < 0) hourShortfall = 0;
      workDeduction = hourShortfall * hourlyRate;
      earnedWorkSalary = Math.max(0, base - workDeduction);
    }

    const earnedWorkSalaryRounded = parseFloat(earnedWorkSalary.toFixed(2));
    const workDeductionRounded = parseFloat(workDeduction.toFixed(2));
    const totalDeductions = parseFloat((workDeductionRounded + extraDed).toFixed(2));
    const netSalary = Math.max(0, Math.round(earnedWorkSalaryRounded + allow - extraDed));

    return {
      base,
      stdHrs,
      stdDays,
      actualHrs,
      actualDays,
      hourlyRate: parseFloat(hourlyRate.toFixed(2)),
      dailyRate: parseFloat(dailyRate.toFixed(2)),
      earnedWorkSalary: earnedWorkSalaryRounded,
      workDeduction: workDeductionRounded,
      extraDed,
      totalDeductions,
      allow,
      netSalary
    };
  }, [baseSalary, expectedHours, expectedDays, calcMethod, allowances, otherDeductions, monthStats]);

  const handleGenerateSlip = async (e) => {
    e.preventDefault();
    if (!empId || !baseSalary) {
      alert('Please select an employee and enter the base salary.');
      return;
    }

    try {
      const [year, monthNum] = salaryMonth.split('-');
      const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const monthLabel = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const empCodeVal = selectedEmp.code || `BID-${selectedEmp.id.substring(0, 5).toUpperCase()}`;

      await addDoc(collection(db, 'content_reports', 'data', 'salary_slips'), {
        employeeId: selectedEmp.id,
        employeeName: selectedEmp.name,
        employeeRole: selectedEmp.role || 'Employee',
        employeeCode: empCodeVal,
        monthKey: salaryMonth,
        monthLabel,
        baseSalary: calculatedSalary.base,
        expectedHours: calculatedSalary.stdHrs,
        actualHours: calculatedSalary.actualHrs,
        daysWorked: monthStats.daysWorked,
        hourlyRate: calculatedSalary.hourlyRate,
        workDeduction: calculatedSalary.workDeduction,
        otherDeductions: calculatedSalary.extraDed,
        totalDeductions: calculatedSalary.totalDeductions,
        allowances: calculatedSalary.allow,
        netSalary: calculatedSalary.netSalary,
        remarks: remarks.trim(),
        issuedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        createdAt: new Date().toISOString()
      });

      setShowGenModal(false);
      setEmpId('');
      setBaseSalary('');
      setAllowances('0');
      setOtherDeductions('0');
      setRemarks('');
      alert(`Salary slip for ${selectedEmp.name} generated successfully!`);
    } catch (err) {
      console.error('Generate salary slip error:', err);
      alert('Failed to generate salary slip.');
    }
  };

  const handleOpenEditSlip = (slip) => {
    setEditingSlip(slip);
    setEditBaseSalary(String(slip.baseSalary || ''));
    setEditExpectedHours(String(slip.expectedHours || '160'));
    setEditExpectedDays(String(slip.expectedDays || '26'));
    setEditAllowances(String(slip.allowances || '0'));
    setEditOtherDeductions(String(slip.otherDeductions || '0'));
    setEditRemarks(slip.remarks || '');
  };

  const handleSaveEditSlip = async (e) => {
    e.preventDefault();
    if (!editingSlip) return;

    try {
      const base = parseFloat(editBaseSalary) || 0;
      const stdHrs = parseFloat(editExpectedHours) || 160;
      const stdDays = parseFloat(editExpectedDays) || 26;
      const allow = parseFloat(editAllowances) || 0;
      const extraDed = parseFloat(editOtherDeductions) || 0;

      const actualHrs = editingSlip.actualHours || 0;
      const actualDays = editingSlip.daysWorked || 0;

      let hourlyRate = stdHrs > 0 ? base / stdHrs : 0;
      let dailyRate = stdDays > 0 ? base / stdDays : 0;
      let earnedWorkSalary = 0;
      let workDeduction = 0;

      if (calcMethod === 'days_worked') {
        earnedWorkSalary = actualDays * dailyRate;
        workDeduction = Math.max(0, base - earnedWorkSalary);
      } else if (calcMethod === 'pro_rata_hours') {
        earnedWorkSalary = actualHrs * hourlyRate;
        workDeduction = Math.max(0, base - earnedWorkSalary);
      } else {
        let hourShortfall = stdHrs - actualHrs;
        if (hourShortfall < 0) hourShortfall = 0;
        workDeduction = hourShortfall * hourlyRate;
        earnedWorkSalary = Math.max(0, base - workDeduction);
      }

      const earnedWorkSalaryRounded = parseFloat(earnedWorkSalary.toFixed(2));
      const workDeductionRounded = parseFloat(workDeduction.toFixed(2));
      const totalDeductions = parseFloat((workDeductionRounded + extraDed).toFixed(2));
      const netSalary = Math.max(0, Math.round(earnedWorkSalaryRounded + allow - extraDed));

      await updateDoc(doc(db, 'content_reports', 'data', 'salary_slips', editingSlip.id), {
        baseSalary: base,
        expectedHours: stdHrs,
        expectedDays: stdDays,
        hourlyRate: parseFloat(hourlyRate.toFixed(2)),
        dailyRate: parseFloat(dailyRate.toFixed(2)),
        workDeduction: workDeductionRounded,
        otherDeductions: extraDed,
        totalDeductions,
        allowances: allow,
        netSalary,
        remarks: editRemarks.trim()
      });

      alert(`Salary slip for ${editingSlip.employeeName} updated successfully!`);
      setEditingSlip(null);
    } catch (err) {
      console.error('Update salary slip error:', err);
      alert('Failed to update salary slip.');
    }
  };

  const handleDeleteSlip = async (id, empName, month) => {
    if (window.confirm(`Delete salary slip for ${empName} (${month})?`)) {
      try {
        await deleteDoc(doc(db, 'content_reports', 'data', 'salary_slips', id));
      } catch (err) {
        console.error('Delete salary slip error:', err);
        alert('Failed to delete salary slip.');
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Print-Only CSS Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-salary-slip, #printable-salary-slip * {
            visibility: visible;
          }
          #printable-salary-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Payroll & Salary Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Generate, calculate, and print professional monthly salary slips with actual work hours breakdown.
          </p>
        </div>

        <button
          onClick={() => setShowGenModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center space-x-2 cursor-pointer shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Generate New Salary Slip</span>
        </button>
      </div>

      {/* SALARY SLIPS TABLE */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Generated Salary Slips ({salarySlips.length})</h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                <th className="p-3">Employee</th>
                <th className="p-3">Month</th>
                <th className="p-3">Base Salary</th>
                <th className="p-3">Work Hours</th>
                <th className="p-3">Deductions</th>
                <th className="p-3">Allowances</th>
                <th className="p-3">Net Payable</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {salarySlips.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    No salary slips generated yet. Click "Generate New Salary Slip" to create one.
                  </td>
                </tr>
              ) : (
                salarySlips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50/50">
                    <td className="p-3">
                      <div>
                        <span className="font-semibold text-slate-900 block">{slip.employeeName}</span>
                        <span className="text-[10px] text-slate-500">{slip.employeeRole} • {slip.employeeCode}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-indigo-700">{slip.monthLabel}</td>
                    <td className="p-3 font-semibold text-slate-800">₹{slip.baseSalary?.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-xs font-mono text-slate-600">
                      {slip.actualHours} hrs <span className="text-slate-400">({slip.daysWorked} days)</span>
                    </td>
                    <td className="p-3 font-semibold text-rose-600">₹{slip.totalDeductions?.toLocaleString('en-IN')}</td>
                    <td className="p-3 font-semibold text-emerald-600">₹{slip.allowances?.toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ₹{slip.netSalary?.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => setViewSlip(slip)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition cursor-pointer flex items-center space-x-1 font-bold text-xs"
                          title="View & Print Salary Slip"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View PDF</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditSlip(slip)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition cursor-pointer flex items-center space-x-1 font-bold text-xs"
                          title="Edit Salary Slip Details"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSlip(slip.id, slip.employeeName, slip.monthLabel)}
                          className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 border border-slate-200 rounded-lg transition cursor-pointer"
                          title="Delete Slip"
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

      {/* GENERATE SALARY SLIP MODAL */}
      {showGenModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowGenModal(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowGenModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center space-x-3 mb-4 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Calculator className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Generate Salary Slip</h3>
                <p className="text-xs text-slate-500">Calculate net payable salary based on work hours & leaves</p>
              </div>
            </div>

            <form onSubmit={handleGenerateSlip} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Select Employee
                  </label>
                  <select
                    required
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Salary Month
                  </label>
                  <input
                    type="month"
                    required
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-1">
                  Salary Calculation Basis Method
                </label>
                <select
                  value={calcMethod}
                  onChange={(e) => setCalcMethod(e.target.value)}
                  className="block w-full px-3 py-2 bg-indigo-50/70 border border-indigo-200 rounded-xl text-indigo-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="pro_rata_hours">⏱️ Pro-Rata Shift Hours (Actual Shift Work Pay)</option>
                  <option value="days_worked">📅 Per-Day Rate (Days Worked Pay)</option>
                  <option value="fixed_shortfall">💼 Fixed Monthly Salary (Minus Unworked Shortfall)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Full Monthly Base Salary (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="E.g., 20000"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {calcMethod === 'days_worked' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Expected Working Days / Month
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={expectedDays}
                      onChange={(e) => setExpectedDays(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Expected Monthly Hours (Full Month)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={expectedHours}
                      onChange={(e) => setExpectedHours(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* LIVE WORK STATS & BREAKDOWN BANNER */}
              {empId && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between font-semibold text-indigo-900 pb-1 border-b border-indigo-100">
                    <span>Logged Work Records:</span>
                    <span className="font-mono font-bold text-indigo-800">{monthStats.actualHours} Shift Hours ({monthStats.daysWorked} days worked)</span>
                  </div>
                  
                  {calcMethod === 'days_worked' ? (
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Calculated Daily Rate:</span>
                      <span className="font-mono">₹{calculatedSalary.dailyRate} / day ({expectedDays} expected days)</span>
                    </div>
                  ) : (
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Calculated Hourly Rate:</span>
                      <span className="font-mono">₹{calculatedSalary.hourlyRate} / hr ({expectedHours} expected hrs)</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-emerald-800 pt-1 border-t border-indigo-100">
                    <span>Earned Work Salary (for Logged Time):</span>
                    <span className="font-mono text-sm">₹{calculatedSalary.earnedWorkSalary.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Bonuses / Allowances (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={allowances}
                    onChange={(e) => setAllowances(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Other Manual Deductions (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={otherDeductions}
                    onChange={(e) => setOtherDeductions(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Optional Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved leave adjustment included..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* FINAL CALCULATED PAYABLE BANNER */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Final Net Payable Salary</span>
                  <span className="text-xs text-emerald-600">Base + Allowances - All Deductions</span>
                </div>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  ₹{calculatedSalary.netSalary.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Generate & Save Salary Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE PROFESSIONAL SALARY SLIP MODAL */}
      {viewSlip && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setViewSlip(null)}>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 5mm 10mm 5mm 10mm;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body > * {
                visibility: hidden !important;
              }
              #printable-salary-slip, #printable-salary-slip * {
                visibility: visible !important;
              }
              #printable-salary-slip {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                right: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: #ffffff !important;
                transform: none !important;
                z-index: 999999 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          <div className="bg-white border border-slate-250 rounded-2xl p-6 sm:p-8 shadow-2xl max-w-2xl w-full relative my-8" onClick={e => e.stopPropagation()}>
            
            {/* Top Action Bar (No Print) */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6 no-print">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Salary Slip Preview</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintPDF}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print / Download PDF</span>
                </button>
                <button
                  onClick={() => setViewSlip(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* PRINTABLE SALARY SLIP TEMPLATE */}
            <div id="printable-salary-slip" className="bg-white space-y-6 text-slate-800 p-2">
              
              {/* COMPANY HEADER WITH ENLARGED LOGO & ADDRESS */}
              <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-5">
                <div className="flex items-center space-x-4">
                  <img src="/LOGO.png" alt="Company Logo" className="h-20 sm:h-24 w-auto object-contain" />
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">BUILDING INDIA DIGITAL</h2>
                    <p className="text-xs sm:text-sm font-bold text-slate-600 mt-1.5 max-w-sm leading-snug">
                      #246, Devaji VIP Plaza, VIP Road, Zirakpur 140603
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-indigo-700 uppercase tracking-widest block">PAYSLIP</span>
                  <span className="text-sm font-bold text-slate-800 font-mono block mt-0.5">{viewSlip.monthLabel}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Issued: {viewSlip.issuedDate}</span>
                </div>
              </div>

              {/* EMPLOYEE & PAYSLIP DETAILS GRID */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-[10px] block">Employee Name</span>
                  <span className="font-bold text-slate-900 text-sm">{viewSlip.employeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-[10px] block">Employee Code / ID</span>
                  <span className="font-bold text-slate-800 font-mono">{viewSlip.employeeCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-[10px] block">Designation / Role</span>
                  <span className="font-medium text-slate-800">{viewSlip.employeeRole}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-[10px] block">Pay Period</span>
                  <span className="font-medium text-slate-800 font-mono">{viewSlip.monthLabel}</span>
                </div>
              </div>

              {/* ATTENDANCE SUMMARY BANNER */}
              <div className="flex justify-between items-center p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs">
                <div>
                  <span className="text-indigo-900 font-bold">Shift Work Hours Logged:</span>
                  <span className="text-indigo-700 font-mono font-bold ml-1.5">{viewSlip.actualHours} Hrs / {viewSlip.expectedHours} Std Hrs</span>
                </div>
                <div>
                  <span className="text-slate-600 font-semibold">Total Days Present:</span>
                  <span className="text-slate-900 font-mono font-bold ml-1">{viewSlip.daysWorked} Days</span>
                </div>
              </div>

              {/* SALARY BREAKDOWN TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3">Earnings</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                      <th className="p-3 border-l border-slate-200">Deductions</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-medium text-slate-800">Basic Monthly Salary</td>
                      <td className="p-3 text-right font-mono font-semibold">₹{viewSlip.baseSalary?.toLocaleString('en-IN')}</td>
                      <td className="p-3 border-l border-slate-200 text-slate-700">Work Hours Shortfall Deduction</td>
                      <td className="p-3 text-right font-mono text-rose-600">₹{viewSlip.workDeduction?.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-800">Bonuses & Allowances</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-600">₹{viewSlip.allowances?.toLocaleString('en-IN')}</td>
                      <td className="p-3 border-l border-slate-200 text-slate-700">Other Deductions / Adjustments</td>
                      <td className="p-3 text-right font-mono text-rose-600">₹{viewSlip.otherDeductions?.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                      <td className="p-3 text-slate-900">Total Earnings</td>
                      <td className="p-3 text-right font-mono text-slate-900">₹{(viewSlip.baseSalary + viewSlip.allowances)?.toLocaleString('en-IN')}</td>
                      <td className="p-3 border-l border-slate-200 text-slate-900">Total Deductions</td>
                      <td className="p-3 text-right font-mono text-rose-700">₹{viewSlip.totalDeductions?.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* NET SALARY TOTAL BANNER */}
              <div className="p-4 bg-emerald-600 text-white rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest block opacity-90">NET PAYABLE SALARY</span>
                  <span className="text-xs font-semibold opacity-90">Final Amount Transferred to Employee</span>
                </div>
                <span className="text-2xl font-black font-mono tracking-tight">
                  ₹{viewSlip.netSalary?.toLocaleString('en-IN')}
                </span>
              </div>

              {viewSlip.remarks && (
                <div className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-semibold not-italic">Notes:</span> {viewSlip.remarks}
                </div>
              )}

              {/* SIGNATURE FOOTER */}
              <div className="pt-8 flex justify-between items-end text-xs text-slate-500 border-t border-slate-200">
                <div className="text-center space-y-1">
                  <div className="w-36 border-b border-slate-300 mb-1"></div>
                  <span className="font-semibold block text-slate-700">Employee Signature</span>
                </div>

                <div className="text-center space-y-1">
                  <div className="w-36 border-b border-slate-300 mb-1"></div>
                  <span className="font-semibold block text-slate-700">Authorised Signatory</span>
                  <span className="text-[10px] text-slate-400 block">Building India Digital</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* EDIT SALARY SLIP MODAL */}
      {editingSlip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setEditingSlip(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setEditingSlip(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <Edit3 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Salary Slip</h3>
                <p className="text-xs text-slate-500">{editingSlip.employeeName} ({editingSlip.monthLabel})</p>
              </div>
            </div>

            <form onSubmit={handleSaveEditSlip} className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Monthly Base Salary (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editBaseSalary}
                    onChange={(e) => setEditBaseSalary(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Expected Hours (Month)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editExpectedHours}
                    onChange={(e) => setEditExpectedHours(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Bonuses & Allowances (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editAllowances}
                    onChange={(e) => setEditAllowances(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Other Deductions (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editOtherDeductions}
                    onChange={(e) => setEditOtherDeductions(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Optional Remarks / Notes
                </label>
                <textarea
                  rows="2"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSlip(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Update Salary Slip</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
