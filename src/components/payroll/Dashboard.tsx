import React from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { formatCurrency } from '@/data/payrollData';
import { Users, DollarSign, TrendingUp, Clock, CheckCircle2, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { employees, payrollRecords, setCurrentView } = usePayroll();

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const monthlyPayroll = payrollRecords.reduce((sum, p) => sum + p.netSalary, 0);
  const pendingPayments = payrollRecords.filter(p => p.status === 'Pending').length;
  const totalDeductions = payrollRecords.reduce((sum, p) => sum + p.totalDeductions, 0);

  const stats = [
    { label: 'Total Employees', value: totalEmployees, change: '+3 this month', icon: Users, color: 'blue', trend: 'up' },
    { label: 'Monthly Payroll', value: formatCurrency(monthlyPayroll), change: '+5.2% vs last month', icon: DollarSign, color: 'green', trend: 'up' },
    { label: 'Total Deductions', value: formatCurrency(totalDeductions), change: 'PAYE + NSSF + SHIF', icon: TrendingUp, color: 'purple', trend: 'neutral' },
    { label: 'Pending Approval', value: pendingPayments, change: 'Needs review', icon: Clock, color: 'orange', trend: 'down' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50',
    green: 'from-green-500 to-green-600 text-green-600 bg-green-50',
    purple: 'from-purple-500 to-purple-600 text-purple-600 bg-purple-50',
    orange: 'from-orange-500 to-orange-600 text-orange-600 bg-orange-50',
  };

  // Department breakdown
  const deptStats = employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + emp.basicSalary;
    return acc;
  }, {} as Record<string, number>);

  const sortedDepts = Object.entries(deptStats).sort((a, b) => b[1] - a[1]);
  const maxDeptSalary = Math.max(...sortedDepts.map(d => d[1]));

  const recentPayrolls = payrollRecords.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 right-20 w-32 h-32 bg-white/5 rounded-full -mb-16"></div>
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Payroll Overview</p>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Ready to process this month's payroll?</h1>
              <p className="text-blue-100 max-w-xl">
                {activeEmployees} active employees pending payment processing. Estimated total: {formatCurrency(monthlyPayroll)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentView('payroll')}
                className="px-5 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition shadow-lg"
              >
                Run Payroll
              </button>
              <button
                onClick={() => setCurrentView('reports')}
                className="px-5 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition backdrop-blur"
              >
                View Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          const colors = colorMap[s.color].split(' ');
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${colors[3]} ${colors[4]} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colors[2]}`} />
                </div>
                {s.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-500" />}
                {s.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-orange-500" />}
              </div>
              <p className="text-xs text-slate-500 font-medium mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 mb-1">{s.value}</p>
              <p className="text-xs text-slate-500">{s.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Salary Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900">Department Salary Distribution</h3>
              <p className="text-xs text-slate-500">Total basic salaries by department</p>
            </div>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none">
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="space-y-4">
            {sortedDepts.map(([dept, total]) => (
              <div key={dept}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700">{dept}</span>
                  <span className="text-slate-900 font-semibold">{formatCurrency(total)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000"
                    style={{ width: `${(total / maxDeptSalary) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-1">Quick Actions</h3>
          <p className="text-xs text-slate-500 mb-4">Common payroll tasks</p>
          <div className="space-y-2">
            {[
              { label: 'Add New Employee', view: 'employees', icon: Users, color: 'blue' },
              { label: 'Process Payroll', view: 'payroll', icon: DollarSign, color: 'green' },
              { label: 'Generate Payslips', view: 'payslips', icon: Calendar, color: 'purple' },
              { label: 'Export Reports', view: 'reports', icon: TrendingUp, color: 'orange' },
            ].map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  onClick={() => setCurrentView(a.view)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-50 rounded-xl transition text-left group"
                >
                  <div className={`w-9 h-9 rounded-lg bg-${a.color}-50 flex items-center justify-center group-hover:bg-${a.color}-100 transition`}>
                    <Icon className={`w-4 h-4 text-${a.color}-600`} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-1">{a.label}</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Payroll */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Recent Payroll Activity</h3>
            <p className="text-xs text-slate-500">Latest payment records</p>
          </div>
          <button onClick={() => setCurrentView('payslips')} className="text-sm text-blue-600 font-medium hover:underline">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Employee</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Gross</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Deductions</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Net Pay</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPayrolls.map(p => {
                const emp = employees.find(e => e.id === p.employeeId);
                if (!emp) return null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={emp.avatar} alt={emp.name} className="w-8 h-8 rounded-full" />
                        <div>
                          <p className="font-medium text-slate-900">{emp.name}</p>
                          <p className="text-xs text-slate-500">{emp.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-700">{formatCurrency(p.grossSalary)}</td>
                    <td className="px-6 py-3 text-red-600">-{formatCurrency(p.totalDeductions)}</td>
                    <td className="px-6 py-3 font-semibold text-slate-900">{formatCurrency(p.netSalary)}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        p.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        p.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {p.status === 'Paid' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
