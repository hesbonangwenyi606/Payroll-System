import React, { useMemo, useState } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { Employee, formatCurrency, PayrollRecord } from '@/data/payrollData';
import {
  Activity,
  BarChart3,
  Calendar,
  DollarSign,
  Download,
  FileText,
  FileSpreadsheet,
  PieChart,
  Printer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

type Period = 'month' | 'quarter' | 'year' | 'all';
type ReportId = 'payroll-summary' | 'tax-deductions' | 'department-costs' | 'bank-file' | 'employee-history' | 'attendance-leave';
type ReportFormat = 'pdf' | 'excel' | 'csv';
type ReportPayload = {
  filename: string;
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

const currentMonth = () => new Date().toISOString().slice(0, 7);
const API_BASE = import.meta.env.VITE_API_URL || '';

const formatMonth = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) return month;
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const monthToDate = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1);
};

const inSelectedPeriod = (month: string, selectedMonth: string, period: Period) => {
  if (period === 'all') return true;
  const target = monthToDate(month);
  const selected = monthToDate(selectedMonth);
  if (period === 'month') return month === selectedMonth;
  if (period === 'year') return target.getFullYear() === selected.getFullYear();
  const targetQuarter = Math.floor(target.getMonth() / 3);
  const selectedQuarter = Math.floor(selected.getMonth() / 3);
  return target.getFullYear() === selected.getFullYear() && targetQuarter === selectedQuarter;
};

const dateInSelectedPeriod = (date: string, selectedMonth: string, period: Period) => {
  if (period === 'all') return true;
  return inSelectedPeriod(String(date || '').slice(0, 7), selectedMonth, period);
};

const csvValue = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const percent = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0;
const escapeHtml = (value: string | number) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filename}.csv`);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const exportExcel = (filename: string, title: string, headers: string[], rows: Array<Array<string | number>>) => {
  const table = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <tr><th colspan="${headers.length}">${escapeHtml(title)}</th></tr>
          <tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([table], { type: 'application/vnd.ms-excel;charset=utf-8' });
  downloadBlob(blob, `${filename}.xls`);
};

const exportPdf = (title: string, scope: string, headers: string[], rows: Array<Array<string | number>>) => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    toast.error('Allow pop-ups to open the PDF report');
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          p { margin: 0; color: #64748b; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; background: #f1f5f9; color: #475569; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; }
          tr:nth-child(even) td { background: #f8fafc; }
          .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(title)}</h1>
          <p>Scope: ${escapeHtml(scope)} • Generated: ${escapeHtml(new Date().toLocaleString())}</p>
        </div>
        <table>
          <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div class="footer">PayrollPro report</div>
        <script>
          window.onload = () => {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const Reports: React.FC = () => {
  const { employees, payrollRecords, attendance, leaveRequests } = usePayroll();
  const [period, setPeriod] = useState<Period>('month');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());

  const scopedPayroll = useMemo(
    () => payrollRecords.filter(record => inSelectedPeriod(record.month, selectedMonth, period)),
    [payrollRecords, period, selectedMonth]
  );

  const scopedAttendance = useMemo(
    () => attendance.filter(record => dateInSelectedPeriod(record.date, selectedMonth, period)),
    [attendance, period, selectedMonth]
  );

  const scopedLeave = useMemo(
    () => leaveRequests.filter(request => dateInSelectedPeriod(request.startDate, selectedMonth, period)),
    [leaveRequests, period, selectedMonth]
  );

  const payrollByEmployee = useMemo(() => {
    return scopedPayroll.reduce((acc, record) => {
      acc[record.employeeId] = (acc[record.employeeId] || 0) + record.netSalary;
      return acc;
    }, {} as Record<string, number>);
  }, [scopedPayroll]);

  const totals = useMemo(() => {
    const gross = scopedPayroll.reduce((sum, record) => sum + record.grossSalary, 0);
    const net = scopedPayroll.reduce((sum, record) => sum + record.netSalary, 0);
    const paye = scopedPayroll.reduce((sum, record) => sum + record.paye, 0);
    const nssf = scopedPayroll.reduce((sum, record) => sum + record.nssf, 0);
    const nhif = scopedPayroll.reduce((sum, record) => sum + record.nhif, 0);
    const pension = scopedPayroll.reduce((sum, record) => sum + record.pension, 0);
    const other = scopedPayroll.reduce((sum, record) => sum + record.otherDeductions, 0);
    return {
      gross,
      net,
      paye,
      nssf,
      nhif,
      pension,
      other,
      deductions: paye + nssf + nhif + pension + other,
      paid: scopedPayroll.filter(record => record.status === 'Paid').length,
      pending: scopedPayroll.filter(record => record.status === 'Pending').length,
    };
  }, [scopedPayroll]);

  const departmentData = useMemo(() => {
    const data = employees.reduce((acc, employee) => {
      const department = employee.department || 'Unassigned';
      if (!acc[department]) acc[department] = { count: 0, baseSalary: 0, netPayroll: 0 };
      acc[department].count += 1;
      acc[department].baseSalary += employee.basicSalary;
      acc[department].netPayroll += payrollByEmployee[employee.id] || 0;
      return acc;
    }, {} as Record<string, { count: number; baseSalary: number; netPayroll: number }>);
    return Object.entries(data).sort((a, b) => b[1].netPayroll - a[1].netPayroll || b[1].baseSalary - a[1].baseSalary);
  }, [employees, payrollByEmployee]);

  const monthlyTrend = useMemo(() => {
    const months = Array.from(new Set(payrollRecords.map(record => record.month))).sort().slice(-6);
    return months.map(month => {
      const records = payrollRecords.filter(record => record.month === month);
      return {
        month,
        net: records.reduce((sum, record) => sum + record.netSalary, 0),
        gross: records.reduce((sum, record) => sum + record.grossSalary, 0),
        records: records.length,
      };
    });
  }, [payrollRecords]);

  const maxTrendNet = Math.max(1, ...monthlyTrend.map(item => item.net));
  const maxDepartmentCost = Math.max(1, ...departmentData.map(([, data]) => Math.max(data.netPayroll, data.baseSalary)));

  const attendanceSummary = {
    present: scopedAttendance.filter(record => record.status === 'Present').length,
    late: scopedAttendance.filter(record => record.status === 'Late').length,
    absent: scopedAttendance.filter(record => record.status === 'Absent').length,
    hours: scopedAttendance.reduce((sum, record) => sum + Number(record.hours || 0), 0),
  };

  const leaveSummary = {
    pending: scopedLeave.filter(request => request.status === 'Pending').length,
    approved: scopedLeave.filter(request => request.status === 'Approved').length,
    rejected: scopedLeave.filter(request => request.status === 'Rejected').length,
    days: scopedLeave.reduce((sum, request) => sum + Number(request.days || 0), 0),
  };

  const reportScopeLabel = period === 'all' ? 'All Time' : `${period[0].toUpperCase()}${period.slice(1)} • ${formatMonth(selectedMonth)}`;

  const buildRows = (reportId: ReportId): ReportPayload => {
    if (reportId === 'tax-deductions') {
      return {
        filename: `tax-deductions-${selectedMonth}`,
        title: 'Tax & Statutory Deductions',
        headers: ['Payroll ID', 'Employee ID', 'Month', 'PAYE', 'NSSF', 'SHIF/NHIF', 'Pension', 'Other', 'Total Deductions'],
        rows: scopedPayroll.map(record => [record.id, record.employeeId, record.month, record.paye, record.nssf, record.nhif, record.pension, record.otherDeductions, record.totalDeductions]),
      };
    }
    if (reportId === 'department-costs') {
      return {
        filename: `department-costs-${selectedMonth}`,
        title: 'Department Cost Analysis',
        headers: ['Department', 'Headcount', 'Base Salary', 'Net Payroll'],
        rows: departmentData.map(([department, data]) => [department, data.count, data.baseSalary, data.netPayroll]),
      };
    }
    if (reportId === 'bank-file') {
      return {
        filename: `bank-payment-file-${selectedMonth}`,
        title: 'Bank Payment File',
        headers: ['Employee ID', 'Employee', 'Bank', 'Account', 'Month', 'Net Pay', 'Status'],
        rows: scopedPayroll.map(record => {
          const employee = employees.find(emp => emp.id === record.employeeId);
          return [record.employeeId, employee?.name || 'Unknown', employee?.bankName || '', employee?.bankAccount || '', record.month, record.netSalary, record.status];
        }),
      };
    }
    if (reportId === 'employee-history') {
      return {
        filename: `employee-payment-history-${selectedMonth}`,
        title: 'Employee Payment History',
        headers: ['Employee ID', 'Employee', 'Department', 'Month', 'Gross', 'Deductions', 'Net Pay', 'Status'],
        rows: scopedPayroll.map(record => {
          const employee = employees.find(emp => emp.id === record.employeeId);
          return [record.employeeId, employee?.name || 'Unknown', employee?.department || '', record.month, record.grossSalary, record.totalDeductions, record.netSalary, record.status];
        }),
      };
    }
    if (reportId === 'attendance-leave') {
      return {
        filename: `attendance-leave-${selectedMonth}`,
        title: 'Attendance & Leave Summary',
        headers: ['Metric', 'Value'],
        rows: [
          ['Present Records', attendanceSummary.present],
          ['Late Records', attendanceSummary.late],
          ['Absent Records', attendanceSummary.absent],
          ['Worked Hours', attendanceSummary.hours],
          ['Pending Leave', leaveSummary.pending],
          ['Approved Leave', leaveSummary.approved],
          ['Rejected Leave', leaveSummary.rejected],
          ['Leave Days', leaveSummary.days],
        ],
      };
    }
    return {
      filename: `payroll-summary-${selectedMonth}`,
      title: 'Payroll Summary',
      headers: ['Payroll ID', 'Employee ID', 'Month', 'Gross', 'Deductions', 'Net Pay', 'Status', 'Payment Date'],
      rows: scopedPayroll.map(record => [record.id, record.employeeId, record.month, record.grossSalary, record.totalDeductions, record.netSalary, record.status, record.paymentDate]),
    };
  };

  const handleExport = async (reportId: ReportId, format: ReportFormat) => {
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({ format, period, month: selectedMonth });
      const res = await fetch(`${API_BASE}/api/reports/export/${reportId}?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Unable to export report');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fallbackExtension = format === 'excel' ? 'xls' : format;
      const filename = filenameMatch?.[1] || `${reportId}-${selectedMonth}.${fallbackExtension}`;
      downloadBlob(blob, filename);
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export report');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const reports: Array<{ id: ReportId; name: string; desc: string; icon: typeof Calendar; color: string }> = [
    { id: 'payroll-summary', name: 'Payroll Summary', desc: 'Gross, deductions, net pay, status, and payment dates', icon: Calendar, color: 'blue' },
    { id: 'tax-deductions', name: 'Tax & Statutory Deductions', desc: 'PAYE, NSSF, SHIF/NHIF, pension, and other deductions', icon: TrendingUp, color: 'red' },
    { id: 'department-costs', name: 'Department Cost Analysis', desc: 'Headcount, salary base, and payroll expense by department', icon: BarChart3, color: 'green' },
    { id: 'bank-file', name: 'Bank Payment File', desc: 'Bank account export for payroll payment preparation', icon: DollarSign, color: 'indigo' },
    { id: 'employee-history', name: 'Employee Payment History', desc: 'Per-employee payroll history for the selected scope', icon: Users, color: 'cyan' },
    { id: 'attendance-leave', name: 'Attendance & Leave Summary', desc: 'Attendance totals, hours, leave counts, and leave days', icon: Activity, color: 'amber' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 print:p-0">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 print:hidden">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Report Scope</p>
            <h3 className="text-xl font-bold text-slate-900">{reportScopeLabel}</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={event => setSelectedMonth(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 overflow-x-auto">
              {[
                { id: 'month', label: 'Month' },
                { id: 'quarter', label: 'Quarter' },
                { id: 'year', label: 'Year' },
                { id: 'all', label: 'All Time' },
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => setPeriod(option.id as Period)}
                  className={`h-11 px-4 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                    period === option.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button onClick={handlePrint} className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1">Gross Payroll</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totals.gross)}</p>
          <p className="text-xs text-slate-500 mt-1">{scopedPayroll.length} payroll records</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1">Net Payroll</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totals.net)}</p>
          <p className="text-xs text-slate-500 mt-1">{totals.paid} paid, {totals.pending} pending</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1">Deductions</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.deductions)}</p>
          <p className="text-xs text-slate-500 mt-1">{percent(totals.deductions, totals.gross)}% of gross payroll</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1">Active Employees</p>
          <p className="text-2xl font-bold text-blue-700">{employees.filter(employee => employee.status === 'Active').length}</p>
          <p className="text-xs text-slate-500 mt-1">{employees.length} total employees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-slate-900">Payroll Trend</h3>
              <p className="text-xs text-slate-500">Net payroll across the latest processed months</p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="h-64 flex items-end gap-3 border-b border-slate-100 pb-4">
            {monthlyTrend.length ? monthlyTrend.map(item => (
              <div key={item.month} className="flex-1 min-w-0 flex flex-col items-center gap-2">
                <div className="w-full flex items-end h-44">
                  <div
                    className="w-full bg-blue-600 rounded-t-lg min-h-2 transition-all"
                    style={{ height: `${Math.max(4, percent(item.net, maxTrendNet))}%` }}
                    title={`${formatMonth(item.month)}: ${formatCurrency(item.net)}`}
                  />
                </div>
                <p className="text-xs font-medium text-slate-700 truncate w-full text-center">{item.month.slice(5)}</p>
                <p className="text-[11px] text-slate-500 truncate w-full text-center">{formatCurrency(item.net)}</p>
              </div>
            )) : (
              <div className="w-full text-center text-sm text-slate-500">No payroll records available for trend analysis.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-slate-900">Deductions Mix</h3>
              <p className="text-xs text-slate-500">Statutory and other deductions</p>
            </div>
            <PieChart className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {[
              { label: 'PAYE', value: totals.paye, color: 'bg-red-500' },
              { label: 'NSSF', value: totals.nssf, color: 'bg-blue-500' },
              { label: 'SHIF/NHIF', value: totals.nhif, color: 'bg-violet-500' },
              { label: 'Pension', value: totals.pension, color: 'bg-green-500' },
              { label: 'Other', value: totals.other, color: 'bg-slate-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="font-semibold">{formatCurrency(item.value)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent(item.value, totals.deductions)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold mb-1">Department Cost Analysis</h3>
          <p className="text-xs text-slate-500 mb-5">Headcount, salary base, and net payroll by department</p>
          <div className="space-y-3">
            {departmentData.map(([department, data]) => (
              <div key={department} className="grid grid-cols-[120px_1fr_120px] gap-3 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{department}</p>
                  <p className="text-xs text-slate-500">{data.count} employees</p>
                </div>
                <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-lg flex items-center px-2 transition-all"
                    style={{ width: `${Math.max(5, percent(Math.max(data.netPayroll, data.baseSalary), maxDepartmentCost))}%` }}
                  >
                    <span className="text-xs text-white font-semibold">{percent(data.netPayroll, totals.net)}%</span>
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-700 text-right">{formatCurrency(data.netPayroll || data.baseSalary)}</div>
              </div>
            ))}
            {!departmentData.length && <p className="text-sm text-slate-500 text-center py-8">No employee departments available.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold mb-1">Attendance & Leave</h3>
          <p className="text-xs text-slate-500 mb-5">Operational totals for the selected scope</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Present', value: attendanceSummary.present, tone: 'text-green-700 bg-green-50' },
              { label: 'Late', value: attendanceSummary.late, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Absent', value: attendanceSummary.absent, tone: 'text-red-700 bg-red-50' },
              { label: 'Worked Hours', value: attendanceSummary.hours.toFixed(1), tone: 'text-blue-700 bg-blue-50' },
              { label: 'Pending Leave', value: leaveSummary.pending, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Leave Days', value: leaveSummary.days, tone: 'text-slate-700 bg-slate-50' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl p-4 ${item.tone}`}>
                <p className="text-xs opacity-80">{item.label}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 print:hidden">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Report Library</h3>
            <p className="text-sm text-slate-500">Export focused reports using the selected scope</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => handleExport('payroll-summary', 'pdf')} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" /> PDF
            </button>
            <button onClick={() => handleExport('payroll-summary', 'excel')} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => handleExport('payroll-summary', 'csv')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(report => {
            const Icon = report.icon;
            return (
              <div key={report.id} className="border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg ${colorMap[report.color]} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900">{report.name}</h4>
                    <p className="text-xs text-slate-500">{report.desc}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleExport(report.id, 'pdf')} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 flex items-center justify-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button onClick={() => handleExport(report.id, 'excel')} className="px-3 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 flex items-center justify-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button onClick={() => handleExport(report.id, 'csv')} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 flex items-center justify-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
