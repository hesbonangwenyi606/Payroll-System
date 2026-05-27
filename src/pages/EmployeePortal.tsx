import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePayroll } from '@/contexts/PayrollContext';
import { formatCurrency } from '@/data/payrollData';
import { Navigate } from 'react-router-dom';

const EmployeePortal: React.FC = () => {
  const { user, logout } = useAuth();
  const { payrollRecords, attendance, leaveRequests } = usePayroll();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const employeeId = user.employeeId || user.id;
  const myPayroll = payrollRecords.filter((record) => record.employeeId === employeeId);
  const myAttendance = attendance.filter((record) => record.employeeId === employeeId);
  const myLeave = leaveRequests.filter((request) => request.employeeId === employeeId);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Employee Portal</h1>
            <p className="text-sm text-slate-500 mt-1">View your payroll, attendance, and leave information in one place.</p>
          </div>
          <button onClick={logout} className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700">
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-4">
              <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-3xl border border-slate-200" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{user.name}</h2>
                <p className="text-sm text-slate-500">{user.position || user.role}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Department</p>
                <p className="mt-2 font-semibold text-slate-900">{user.department || 'N/A'}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Role</p>
                <p className="mt-2 font-semibold text-slate-900">{user.role}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Payroll summary</h2>
                  <p className="text-sm text-slate-500">Your recent payslips and net salary history.</p>
                </div>
              </div>

              {myPayroll.length ? (
                <div className="mt-5 space-y-4">
                  {myPayroll.slice(0, 3).map((record) => (
                    <div key={record.id} className="rounded-3xl border border-slate-200 p-4 bg-slate-50">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-500">{record.month}</p>
                          <p className="font-semibold text-slate-900">Net Salary: {formatCurrency(record.netSalary)}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${record.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {record.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">No payroll records available yet.</p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Attendance</h3>
                {myAttendance.length ? (
                  <ul className="mt-4 space-y-3 text-sm text-slate-600">
                    {myAttendance.slice(0, 4).map((record) => (
                      <li key={record.id} className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span>{record.date}</span>
                          <span className="font-semibold">{record.status}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No attendance entries found.</p>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Leave Requests</h3>
                {myLeave.length ? (
                  <ul className="mt-4 space-y-3 text-sm text-slate-600">
                    {myLeave.slice(0, 4).map((request) => (
                      <li key={request.id} className="rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{request.type}</p>
                            <p className="text-xs text-slate-500">{request.startDate} → {request.endDate}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{request.status}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No leave requests found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeePortal;
