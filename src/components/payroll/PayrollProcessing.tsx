import React, { useEffect, useMemo, useState } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { formatCurrency, processPayroll } from '@/data/payrollData';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const formatMonth = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) return month;
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

export const PayrollProcessing: React.FC = () => {
  const {
    employees,
    payrollRecords,
    payrollCycle,
    payrollCycleLoading,
    selectedPayrollMonth,
    setSelectedPayrollMonth,
    refreshPayrollCycle,
    runPayroll,
    approvePayroll,
  } = usePayroll();
  const [step, setStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);

  const activeEmps = useMemo(() => employees.filter(e => e.status === 'Active'), [employees]);
  const monthRecords = useMemo(
    () => payrollRecords.filter(p => p.month === selectedPayrollMonth),
    [payrollRecords, selectedPayrollMonth]
  );
  const pendingRecords = useMemo(
    () => monthRecords.filter(p => p.status === 'Pending'),
    [monthRecords]
  );
  const totalGross = activeEmps.reduce((s, e) => s + e.basicSalary + e.allowances, 0);
  const totalNet = monthRecords.reduce((s, r) => s + r.netSalary, 0);
  const isLocked = Boolean(payrollCycle && !payrollCycle.canGenerate && payrollCycle.totalRecords > 0);
  const canGenerate = Boolean(payrollCycle?.canGenerate && activeEmps.length > 0 && !processing);

  useEffect(() => {
    if (payrollCycle?.totalRecords) {
      setStep(3);
    } else if (step === 3) {
      setStep(1);
    }
  }, [payrollCycle?.totalRecords, step]);

  const handleRun = async () => {
    setProcessing(true);
    try {
      const created = await runPayroll(selectedPayrollMonth);
      setStep(3);
      toast.success(`Payroll processed for ${created.length} employees`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payroll processing failed');
      await refreshPayrollCycle(selectedPayrollMonth);
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveAll = async () => {
    setApproving(true);
    try {
      await Promise.all(pendingRecords.map(r => approvePayroll(r.id)));
      toast.success(`Approved ${pendingRecords.length} payslips`);
      await refreshPayrollCycle(selectedPayrollMonth);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to approve payslips');
    } finally {
      setApproving(false);
    }
  };

  const statusClasses: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-700 border-slate-200',
    Processed: 'bg-amber-50 text-amber-700 border-amber-200',
    'Partially Paid': 'bg-blue-50 text-blue-700 border-blue-200',
    Paid: 'bg-green-50 text-green-700 border-green-200',
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payroll Cycle</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <h2 className="text-2xl font-bold text-slate-900">{formatMonth(selectedPayrollMonth)}</h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${statusClasses[payrollCycle?.status || 'Not Started']}`}>
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {payrollCycle?.status || 'Not Started'}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="month"
              value={selectedPayrollMonth}
              onChange={(event) => setSelectedPayrollMonth(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => refreshPayrollCycle(selectedPayrollMonth)}
              className="h-11 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-sm font-semibold"
            >
              <RefreshCw className={`w-4 h-4 ${payrollCycleLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Active Employees</p>
            <p className="text-2xl font-bold text-slate-900">{payrollCycle?.activeEmployees ?? activeEmps.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Payslips</p>
            <p className="text-2xl font-bold text-slate-900">{payrollCycle?.totalRecords ?? monthRecords.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-700">{payrollCycle?.pendingRecords ?? pendingRecords.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Net Payroll</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalNet)}</p>
          </div>
        </div>

        {isLocked && (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <Lock className="w-5 h-5 flex-shrink-0" />
            <p>
              This period is locked because payroll records already exist. Select another month to run a new cycle, or approve the pending payslips below.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {[
            { n: 1, label: 'Review Employees' },
            { n: 2, label: 'Process Payroll' },
            { n: 3, label: 'Approve & Pay' },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step >= s.n ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'
                }`}>
                  {step > s.n ? <CheckCircle2 className="w-5 h-5" /> : s.n}
                </div>
                <p className={`text-xs mt-2 font-medium ${step >= s.n ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</p>
              </div>
              {i < 2 && <div className={`h-0.5 flex-1 ${step > s.n ? 'bg-blue-600' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 mb-1">Eligible Employees</p>
              <p className="text-3xl font-bold text-slate-900">{activeEmps.length}</p>
              <p className="text-xs text-green-600 mt-1">Active status only</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 mb-1">Estimated Gross</p>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalGross)}</p>
              <p className="text-xs text-slate-500 mt-1">Before statutory deductions</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 mb-1">Pay Period</p>
              <p className="text-3xl font-bold text-slate-900">{formatMonth(selectedPayrollMonth)}</p>
              <p className="text-xs text-slate-500 mt-1">Monthly cycle</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold">Employees to Process</h3>
              <p className="text-xs text-slate-500">Review eligible employees before running payroll</p>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Employee</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Department</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Basic</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Allowances</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Est. Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeEmps.map(e => {
                    const preview = processPayroll(e);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <img src={e.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{e.name}</p>
                              <p className="text-xs text-slate-500">{e.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{e.department}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(e.basicSalary)}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(e.allowances)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-700">{formatCurrency(preview.netSalary)}</td>
                      </tr>
                    );
                  })}
                  {!activeEmps.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                        No active employees are available for payroll.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!payrollCycle?.canGenerate}
              onClick={() => setStep(2)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Processing <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-2xl mx-auto">
          {!processing && (
            <>
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Ready to Process Payroll</h3>
              <p className="text-slate-500 mb-6">
                Generate locked payslips for {activeEmps.length} active employees in {formatMonth(selectedPayrollMonth)}.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left text-sm space-y-2">
                {[
                  'PAYE tax based on Kenya tax brackets',
                  'NSSF deduction capped from pensionable pay',
                  'SHIF/NHIF deduction from gross salary',
                  'Pension contribution and net salary computation',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> {item}
                  </div>
                ))}
              </div>
              {!canGenerate && (
                <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p>This month cannot be processed again. Select an open month to continue.</p>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  disabled={!canGenerate}
                  onClick={handleRun}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" /> Run Payroll Now
                </button>
              </div>
            </>
          )}
          {processing && (
            <div className="py-8">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold">Processing payroll...</p>
              <p className="text-sm text-slate-500">Calculating deductions and generating payslips</p>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className={`rounded-2xl p-6 text-white ${pendingRecords.length ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-green-500 to-emerald-600'}`}>
            <div className="flex items-center gap-4">
              {pendingRecords.length ? <Clock className="w-12 h-12" /> : <CheckCircle2 className="w-12 h-12" />}
              <div>
                <h3 className="text-xl font-bold">
                  {pendingRecords.length ? 'Payroll Processed, Approval Pending' : 'Payroll Cycle Fully Paid'}
                </h3>
                <p className={pendingRecords.length ? 'text-amber-100' : 'text-green-100'}>
                  {monthRecords.length} payslips exist for {formatMonth(selectedPayrollMonth)}. This cycle cannot be processed again.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Payslip Approval</h3>
                <p className="text-xs text-slate-500">{pendingRecords.length} pending, {payrollCycle?.paidRecords ?? 0} paid</p>
              </div>
              <button
                disabled={!pendingRecords.length || approving}
                onClick={handleApproveAll}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approving ? 'Approving...' : 'Approve All'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Employee</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Gross</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Deductions</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Net</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthRecords.map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {emp?.avatar && <img src={emp.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />}
                            <span className="font-medium">{emp?.name || r.employeeId}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(r.grossSalary)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">-{formatCurrency(r.totalDeductions)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(r.netSalary)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.status === 'Paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            disabled={r.status === 'Paid' || approving}
                            onClick={() => approvePayroll(r.id)}
                            className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {r.status === 'Paid' ? 'Locked' : 'Approve'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!monthRecords.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        No payslips have been generated for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
