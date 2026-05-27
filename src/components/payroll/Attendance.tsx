import React, { useMemo, useState } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  Search,
  Timer,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || '';
type Tab = 'attendance' | 'leave' | 'overtime';

const todayIso = () => new Date().toISOString().slice(0, 10);

const csvValue = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  if (!rows.length) {
    toast.error('No rows match the current filters');
    return;
  }
  const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const calculateHours = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return 0;
  const [inHour, inMinute] = checkIn.split(':').map(Number);
  const [outHour, outMinute] = checkOut.split(':').map(Number);
  const minutes = Math.max(0, outHour * 60 + outMinute - (inHour * 60 + inMinute));
  return Number((minutes / 60).toFixed(2));
};

const statusClass = (status: string) => {
  if (status === 'Approved' || status === 'Present') return 'bg-green-100 text-green-700';
  if (status === 'Rejected' || status === 'Absent') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

export const Attendance: React.FC = () => {
  const {
    employees,
    attendance,
    leaveRequests,
    approveLeave,
    addLeaveRequest,
    clockIn,
    clockOut,
    refresh,
  } = usePayroll();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('attendance');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(todayIso().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState('All');
  const [saving, setSaving] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employeeId: user?.role === 'Employee' ? user.employeeId || '' : '',
    type: 'Annual Leave',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [attendanceForm, setAttendanceForm] = useState({
    employeeId: '',
    date: todayIso(),
    checkIn: '08:00',
    checkOut: '17:00',
    status: 'Present',
  });

  const isManager = user?.role === 'Admin' || user?.role === 'HR';
  const employeeById = useMemo(() => {
    const map: Record<string, typeof employees[number]> = {};
    employees.forEach(employee => { map[employee.id] = employee; });
    return map;
  }, [employees]);

  const enrichedAttendance = useMemo(() => attendance
    .map(record => ({ ...record, employee: employeeById[record.employeeId] }))
    .filter(record => record.employee), [attendance, employeeById]);

  const enrichedLeave = useMemo(() => leaveRequests
    .map(request => ({ ...request, employee: employeeById[request.employeeId] }))
    .filter(request => request.employee), [leaveRequests, employeeById]);

  const filteredAttendance = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedAttendance.filter(record => {
      const matchesSearch = !term ||
        record.employee.name.toLowerCase().includes(term) ||
        record.employee.id.toLowerCase().includes(term) ||
        record.employee.department.toLowerCase().includes(term);
      const matchesDate = !dateFilter || record.date.startsWith(dateFilter);
      const matchesStatus = statusFilter === 'All' || record.status === statusFilter;
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [dateFilter, enrichedAttendance, search, statusFilter]);

  const filteredLeave = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedLeave.filter(request => {
      const matchesSearch = !term ||
        request.employee.name.toLowerCase().includes(term) ||
        request.employee.id.toLowerCase().includes(term) ||
        request.type.toLowerCase().includes(term);
      const matchesDate = !dateFilter || request.startDate.startsWith(dateFilter) || request.endDate.startsWith(dateFilter);
      const matchesStatus = statusFilter === 'All' || request.status === statusFilter;
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [dateFilter, enrichedLeave, search, statusFilter]);

  const overtimeRows = useMemo(() => filteredAttendance
    .filter(record => Number(record.hours) > 8)
    .map(record => ({
      ...record,
      overtimeHours: Number((Number(record.hours) - 8).toFixed(2)),
    })), [filteredAttendance]);

  const today = todayIso();
  const todayRecords = enrichedAttendance.filter(record => record.date === today);
  const myTodayRecord = user?.employeeId
    ? enrichedAttendance.find(record => record.employeeId === user.employeeId && record.date === today)
    : undefined;
  const presentToday = todayRecords.filter(record => record.status === 'Present').length;
  const lateToday = todayRecords.filter(record => record.status === 'Late').length;
  const absentToday = todayRecords.filter(record => record.status === 'Absent').length;
  const pendingLeave = enrichedLeave.filter(request => request.status === 'Pending').length;
  const totalHours = filteredAttendance.reduce((sum, record) => sum + Number(record.hours || 0), 0);
  const totalOvertime = overtimeRows.reduce((sum, record) => sum + record.overtimeHours, 0);

  const handleClockIn = async () => {
    try {
      await clockIn();
      toast.success('Clocked in successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Clock in failed');
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOut();
      toast.success('Clocked out successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Clock out failed');
    }
  };

  const handleLeaveApprove = async (id: string, nextStatus: 'Approved' | 'Rejected') => {
    try {
      await approveLeave(id, nextStatus);
      toast.success(`Leave ${nextStatus.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update leave request');
    }
  };

  const handleLeaveSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const employeeId = user?.role === 'Employee' ? user.employeeId || '' : leaveForm.employeeId;
    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    if (!employeeId) {
      toast.error('Select an employee');
      return;
    }
    if (end < start) {
      toast.error('End date cannot be before start date');
      return;
    }
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    setSaving(true);
    try {
      await addLeaveRequest({
        employeeId,
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        days,
        reason: leaveForm.reason,
        status: 'Pending',
      });
      toast.success('Leave request submitted');
      setShowLeaveForm(false);
      setLeaveForm({ employeeId: user?.role === 'Employee' ? user.employeeId || '' : '', type: 'Annual Leave', startDate: '', endDate: '', reason: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to submit leave request');
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const hours = calculateHours(attendanceForm.checkIn, attendanceForm.checkOut);
      const response = await fetch(`${API_BASE}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employee_id: attendanceForm.employeeId,
          date: attendanceForm.date,
          check_in: attendanceForm.status === 'Absent' ? null : attendanceForm.checkIn,
          check_out: attendanceForm.status === 'Absent' ? null : attendanceForm.checkOut,
          hours: attendanceForm.status === 'Absent' ? 0 : hours,
          status: attendanceForm.status,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'Unable to create attendance record');
      await refresh();
      toast.success('Attendance record added');
      setShowAttendanceForm(false);
      setAttendanceForm({ employeeId: '', date: todayIso(), checkIn: '08:00', checkOut: '17:00', status: 'Present' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create attendance record');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (tab === 'leave') {
      downloadCsv(
        `leave-${dateFilter || 'all'}.csv`,
        ['Employee ID', 'Employee', 'Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason'],
        filteredLeave.map(row => [row.employeeId, row.employee.name, row.type, row.startDate, row.endDate, row.days, row.status, row.reason])
      );
      return;
    }
    if (tab === 'overtime') {
      downloadCsv(
        `overtime-${dateFilter || 'all'}.csv`,
        ['Employee ID', 'Employee', 'Date', 'Hours Worked', 'Overtime Hours', 'Status'],
        overtimeRows.map(row => [row.employeeId, row.employee.name, row.date, row.hours, row.overtimeHours, row.status])
      );
      return;
    }
    downloadCsv(
      `attendance-${dateFilter || 'all'}.csv`,
      ['Employee ID', 'Employee', 'Department', 'Date', 'Check In', 'Check Out', 'Hours', 'Status'],
      filteredAttendance.map(row => [row.employeeId, row.employee.name, row.employee.department, row.date, row.checkIn, row.checkOut, row.hours, row.status])
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Time Clock</p>
            <h3 className="text-xl font-bold text-slate-900">Today, {today}</h3>
            <p className="text-sm text-slate-500">
              {myTodayRecord
                ? `Your status: ${myTodayRecord.status}${myTodayRecord.checkOut ? `, clocked out at ${myTodayRecord.checkOut}` : ', currently clocked in'}`
                : 'No clock-in recorded for your account today.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              disabled={!user?.employeeId || Boolean(myTodayRecord)}
              onClick={handleClockIn}
              className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4" /> Clock In
            </button>
            <button
              disabled={!myTodayRecord || Boolean(myTodayRecord.checkOut)}
              onClick={handleClockOut}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" /> Clock Out
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Present Today', value: presentToday, icon: CheckCircle2, tone: 'text-green-600' },
          { label: 'Late Today', value: lateToday, icon: Clock, tone: 'text-amber-600' },
          { label: 'Absent Today', value: absentToday, icon: XCircle, tone: 'text-red-600' },
          { label: 'Pending Leave', value: pendingLeave, icon: AlertCircle, tone: 'text-blue-600' },
          { label: 'Overtime Hours', value: totalOvertime.toFixed(1), icon: Timer, tone: 'text-violet-600' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${item.tone}`} />
                <span className="text-xs text-slate-500">{item.label.includes('Today') ? 'Today' : 'Scope'}</span>
              </div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-slate-500">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_150px_150px_auto_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search employee, ID, department, or leave type..."
              className="w-full h-11 pl-10 pr-4 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <input
            type="month"
            value={dateFilter}
            onChange={event => setDateFilter(event.target.value)}
            className="h-11 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-blue-500"
          />
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className="h-11 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button onClick={handleExport} className="h-11 px-4 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
          {isManager && (
            <button onClick={() => setShowAttendanceForm(true)} className="h-11 px-4 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Record
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex overflow-x-auto">
            {[
              { id: 'attendance', label: 'Daily Attendance' },
              { id: 'leave', label: 'Leave Requests' },
              { id: 'overtime', label: 'Overtime Tracking' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  tab === item.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === 'leave' && (
            <button onClick={() => setShowLeaveForm(true)} className="mx-4 mb-3 sm:mb-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" /> New Request
            </button>
          )}
        </div>

        {tab === 'attendance' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Check In</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Check Out</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Hours</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!filteredAttendance.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No attendance records match your filters</td></tr>
                )}
                {filteredAttendance.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img src={record.employee.avatar} className="w-8 h-8 rounded-full object-cover bg-slate-100" alt="" />
                        <div>
                          <p className="font-medium">{record.employee.name}</p>
                          <p className="text-xs text-slate-500">{record.employee.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.date}</td>
                    <td className="px-4 py-3">{record.status === 'Absent' ? '-' : record.checkIn || 'Open'}</td>
                    <td className="px-4 py-3">{record.status === 'Absent' ? '-' : record.checkOut || 'Open'}</td>
                    <td className="px-4 py-3 font-medium">{Number(record.hours || 0).toFixed(2)}h</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(record.status)}`}>{record.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'leave' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Dates</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!filteredLeave.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No leave requests match your filters</td></tr>
                )}
                {filteredLeave.map(request => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img src={request.employee.avatar} className="w-8 h-8 rounded-full object-cover bg-slate-100" alt="" />
                        <div>
                          <p className="font-medium">{request.employee.name}</p>
                          <p className="text-xs text-slate-500">{request.employee.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{request.type}</td>
                    <td className="px-4 py-3 text-slate-600">{request.startDate} to {request.endDate}</td>
                    <td className="px-4 py-3 font-medium">{request.days}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(request.status)}`}>{request.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isManager && request.status === 'Pending' ? (
                        <div className="flex gap-1 justify-end">
                          <button title="Approve" onClick={() => handleLeaveApprove(request.id, 'Approved')} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button title="Reject" onClick={() => handleLeaveApprove(request.id, 'Rejected')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'overtime' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Worked</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Overtime</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!overtimeRows.length && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No overtime records match your filters</td></tr>
                )}
                {overtimeRows.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img src={record.employee.avatar} className="w-8 h-8 rounded-full object-cover bg-slate-100" alt="" />
                        <span className="font-medium">{record.employee.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.date}</td>
                    <td className="px-4 py-3 font-medium">{Number(record.hours).toFixed(2)}h</td>
                    <td className="px-4 py-3 font-semibold text-violet-700">{record.overtimeHours.toFixed(2)}h</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Calculated</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showLeaveForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold">New Leave Request</h3>
              <button onClick={() => setShowLeaveForm(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleLeaveSubmit} className="p-6 space-y-3">
              {isManager && (
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Employee</label>
                  <select required value={leaveForm.employeeId} onChange={event => setLeaveForm({ ...leaveForm, employeeId: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500">
                    <option value="">Select employee...</option>
                    {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} ({employee.id})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Leave Type</label>
                <select value={leaveForm.type} onChange={event => setLeaveForm({ ...leaveForm, type: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500">
                  <option>Annual Leave</option>
                  <option>Sick Leave</option>
                  <option>Maternity Leave</option>
                  <option>Paternity Leave</option>
                  <option>Personal Leave</option>
                  <option>Compassionate Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Start Date</label>
                  <input required type="date" value={leaveForm.startDate} onChange={event => setLeaveForm({ ...leaveForm, startDate: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">End Date</label>
                  <input required type="date" value={leaveForm.endDate} onChange={event => setLeaveForm({ ...leaveForm, endDate: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Reason</label>
                <textarea required value={leaveForm.reason} onChange={event => setLeaveForm({ ...leaveForm, reason: event.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowLeaveForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50">Cancel</button>
                <button disabled={saving} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAttendanceForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold">Add Attendance Record</h3>
              <button onClick={() => setShowAttendanceForm(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAttendanceSubmit} className="p-6 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Employee</label>
                <select required value={attendanceForm.employeeId} onChange={event => setAttendanceForm({ ...attendanceForm, employeeId: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500">
                  <option value="">Select employee...</option>
                  {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} ({employee.id})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Date</label>
                  <input required type="date" value={attendanceForm.date} onChange={event => setAttendanceForm({ ...attendanceForm, date: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Status</label>
                  <select value={attendanceForm.status} onChange={event => setAttendanceForm({ ...attendanceForm, status: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500">
                    <option>Present</option>
                    <option>Late</option>
                    <option>Absent</option>
                  </select>
                </div>
              </div>
              {attendanceForm.status !== 'Absent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Check In</label>
                    <input required type="time" value={attendanceForm.checkIn} onChange={event => setAttendanceForm({ ...attendanceForm, checkIn: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Check Out</label>
                    <input required type="time" value={attendanceForm.checkOut} onChange={event => setAttendanceForm({ ...attendanceForm, checkOut: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                Calculated hours: {attendanceForm.status === 'Absent' ? '0.00' : calculateHours(attendanceForm.checkIn, attendanceForm.checkOut).toFixed(2)}h
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowAttendanceForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50">Cancel</button>
                <button disabled={saving} type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
