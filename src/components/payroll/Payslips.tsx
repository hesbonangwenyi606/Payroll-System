import React, { useEffect, useMemo, useState } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { Employee, formatCurrency, PayrollRecord } from '@/data/payrollData';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Printer,
  Search,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || '';
const PAGE_SIZE = 12;

type EnrichedPayslip = PayrollRecord & { employee: Employee };

const formatMonth = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) return month;
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const csvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const Payslips: React.FC = () => {
  const { employees, payrollRecords, currentUser } = usePayroll();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [month, setMonth] = useState('All');
  const [sort, setSort] = useState<'newest' | 'net-high' | 'net-low' | 'employee'>('newest');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<EnrichedPayslip | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const enriched = useMemo(() => payrollRecords
    .map(r => ({
      ...r,
      employee: employees.find(e => e.id === r.employeeId),
    }))
    .filter((r): r is EnrichedPayslip => Boolean(r.employee)), [employees, payrollRecords]);

  const availableMonths = useMemo(
    () => Array.from(new Set(enriched.map(r => r.month))).sort((a, b) => b.localeCompare(a)),
    [enriched]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const records = enriched.filter(r => {
      const matchesSearch = !term ||
        r.employee.name.toLowerCase().includes(term) ||
        r.employee.id.toLowerCase().includes(term) ||
        r.employee.email.toLowerCase().includes(term) ||
        r.month.toLowerCase().includes(term);
      const matchesStatus = status === 'All' || r.status === status;
      const matchesMonth = month === 'All' || r.month === month;
      return matchesSearch && matchesStatus && matchesMonth;
    });

    return [...records].sort((a, b) => {
      if (sort === 'net-high') return b.netSalary - a.netSalary;
      if (sort === 'net-low') return a.netSalary - b.netSalary;
      if (sort === 'employee') return a.employee.name.localeCompare(b.employee.name);
      return b.month.localeCompare(a.month) || b.paymentDate.localeCompare(a.paymentDate);
    });
  }, [enriched, month, search, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paidCount = filtered.filter(r => r.status === 'Paid').length;
  const pendingCount = filtered.filter(r => r.status === 'Pending').length;
  const totalNet = filtered.reduce((sum, r) => sum + r.netSalary, 0);

  useEffect(() => {
    setPage(1);
  }, [search, status, month, sort]);

  useEffect(() => {
    if (!viewing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewing(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewing]);

  const handleDownload = async (r: EnrichedPayslip) => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/api/payslips/${r.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Unable to download payslip');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${r.employee.id}-${r.month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Payslip PDF downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download payslip');
    }
  };

  const handleEmail = async (r: EnrichedPayslip) => {
    if (currentUser.role === 'Employee') {
      toast.error('Only Admin and HR users can email payslip notifications');
      return;
    }
    setSendingId(r.id);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/api/notifications/salary-processed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ employeeId: r.employee.id, payrollId: r.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Unable to email payslip');
      toast.success(body?.message || `Payslip notification sent to ${r.employee.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to email payslip');
    } finally {
      setSendingId(null);
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.error('No payslips match the current filters');
      return;
    }
    const headers = ['Payroll ID', 'Employee ID', 'Employee', 'Email', 'Month', 'Status', 'Gross', 'Deductions', 'Net Pay', 'Payment Date'];
    const rows = filtered.map(r => [
      r.id,
      r.employee.id,
      r.employee.name,
      r.employee.email,
      r.month,
      r.status,
      r.grossSalary,
      r.totalDeductions,
      r.netSalary,
      r.paymentDate,
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslips-${month === 'All' ? 'all-months' : month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} payslips`);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('All');
    setMonth('All');
    setSort('newest');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Payslips Found</p>
          <p className="text-2xl font-bold text-slate-900">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Paid</p>
          <p className="text-2xl font-bold text-green-700">{paidCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Net Pay</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalNet)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px_170px_170px_auto_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by employee, email, ID, or month..."
              className="w-full h-11 pl-10 pr-4 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="h-11 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-blue-500">
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)} className="h-11 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-blue-500">
            <option value="All">All Months</option>
            {availableMonths.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="h-11 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-blue-500">
            <option value="newest">Newest First</option>
            <option value="employee">Employee A-Z</option>
            <option value="net-high">Net Pay High</option>
            <option value="net-low">Net Pay Low</option>
          </select>
          <button onClick={clearFilters} className="h-11 px-4 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">
            Clear
          </button>
          <button onClick={handleExport} className="h-11 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={r.employee.avatar} className="w-11 h-11 rounded-full object-cover bg-slate-100" alt="" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{r.employee.name}</p>
                  <p className="text-xs text-slate-500 truncate">{r.employee.id} • {formatMonth(r.month)}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                r.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}>{r.status}</span>
            </div>
            <div className="space-y-1.5 text-sm border-t border-slate-100 pt-3 mb-3">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Gross</span><span>{formatCurrency(r.grossSalary)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Deductions</span><span className="text-red-600">-{formatCurrency(r.totalDeductions)}</span></div>
              <div className="flex justify-between gap-3 font-bold pt-1.5 border-t border-slate-100"><span>Net Pay</span><span className="text-green-700">{formatCurrency(r.netSalary)}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setViewing(r)} className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 flex items-center justify-center gap-1">
                <FileText className="w-3.5 h-3.5" /> View
              </button>
              <button title="Download PDF" onClick={() => handleDownload(r)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button title="Email notification" disabled={sendingId === r.id} onClick={() => handleEmail(r)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
                {sendingId === r.id ? <Send className="w-3.5 h-3.5 animate-pulse" /> : <Mail className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {!visible.length && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-900">No payslips found</p>
          <p className="text-sm text-slate-500 mt-1">Change the filters or process payroll for a new month.</p>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              Previous
            </button>
            <button disabled={page === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onMouseDown={() => setViewing(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl my-8 shadow-2xl print:shadow-none"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 print:hidden">
              <div>
                <h3 className="font-bold">Payslip Preview</h3>
                <p className="text-xs text-slate-500">{viewing.employee.name} • {formatMonth(viewing.month)}</p>
              </div>
              <div className="flex gap-2">
                <button title="Print" onClick={() => window.print()} className="p-2 hover:bg-slate-100 rounded-lg"><Printer className="w-4 h-4" /></button>
                <button title="Download PDF" onClick={() => handleDownload(viewing)} className="p-2 hover:bg-slate-100 rounded-lg"><Download className="w-4 h-4" /></button>
                <button title="Email notification" onClick={() => handleEmail(viewing)} className="p-2 hover:bg-slate-100 rounded-lg"><Mail className="w-4 h-4" /></button>
                <button title="Close" onClick={() => setViewing(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-8">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 pb-6 border-b-2 border-slate-200 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold text-lg">PayrollPro Inc.</span>
                  </div>
                  <p className="text-xs text-slate-500">123 Business Park, Nairobi, Kenya<br />info@payrollpro.co.ke</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-slate-500">Payslip Period</p>
                  <p className="font-bold text-lg">{formatMonth(viewing.month)}</p>
                  <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    viewing.status === 'Paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> {viewing.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 text-sm">
                {[
                  ['Employee Name', viewing.employee.name],
                  ['Employee ID', viewing.employee.id],
                  ['Department', viewing.employee.department],
                  ['Position', viewing.employee.position],
                  ['Bank', viewing.employee.bankName || 'N/A'],
                  ['Account', viewing.employee.bankAccount || 'N/A'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                    <p className="font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-xl p-4">
                  <h4 className="font-bold text-green-900 text-sm mb-3">Earnings</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Basic Salary</span><span>{formatCurrency(viewing.basicSalary)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Allowances</span><span>{formatCurrency(viewing.allowances)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Overtime</span><span>{formatCurrency(viewing.overtime)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Bonus</span><span>{formatCurrency(viewing.bonus)}</span></div>
                    <div className="flex justify-between gap-3 font-bold pt-2 border-t border-green-200"><span>Gross</span><span>{formatCurrency(viewing.grossSalary)}</span></div>
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="font-bold text-red-900 text-sm mb-3">Deductions</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-slate-600">PAYE Tax</span><span>{formatCurrency(viewing.paye)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">NSSF</span><span>{formatCurrency(viewing.nssf)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">SHIF/NHIF</span><span>{formatCurrency(viewing.nhif)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Pension</span><span>{formatCurrency(viewing.pension)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-600">Other</span><span>{formatCurrency(viewing.otherDeductions)}</span></div>
                    <div className="flex justify-between gap-3 font-bold pt-2 border-t border-red-200"><span>Total</span><span>{formatCurrency(viewing.totalDeductions)}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600 text-white rounded-xl p-5 mt-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <p className="text-blue-100 text-sm">Net Pay</p>
                  <p className="text-3xl font-bold">{formatCurrency(viewing.netSalary)}</p>
                </div>
                <div className="sm:text-right text-sm text-blue-100">
                  <div className="flex sm:justify-end items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Payment Date</span>
                  </div>
                  <p className="font-semibold text-white">{viewing.paymentDate}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-between items-center print:hidden">
                <button onClick={() => setViewing(null)} className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
                  Close Preview
                </button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => handleDownload(viewing)} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Download
                  </button>
                  <button onClick={() => handleEmail(viewing)} className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center mt-6">This is a computer-generated payslip and does not require a signature.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
