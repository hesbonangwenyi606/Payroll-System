import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  Employee, PayrollRecord, LeaveRequest, AttendanceRecord, AuditLog,
  dbToEmployee, employeeToDb, dbToPayroll, dbToLeave, dbToAttendance, dbToAudit,
} from '@/data/payrollData';
import { useAuth } from '@/contexts/AuthContext';

interface PayrollContextType {
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  payrollCycle: PayrollCycle | null;
  payrollCycleLoading: boolean;
  selectedPayrollMonth: string;
  leaveRequests: LeaveRequest[];
  attendance: AttendanceRecord[];
  auditLogs: AuditLog[];
  loading: boolean;
  refresh: () => Promise<void>;
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<Employee | null>;
  updateEmployee: (id: string, emp: Partial<Employee>) => Promise<void>;
  uploadEmployeePhoto: (id: string, file: File) => Promise<Employee | null>;
  deleteEmployee: (id: string) => Promise<void>;
  setSelectedPayrollMonth: (month: string) => void;
  refreshPayrollCycle: (month?: string) => Promise<void>;
  runPayroll: (month?: string) => Promise<PayrollRecord[]>;
  approvePayroll: (id: string) => Promise<void>;
  approveLeave: (id: string, status: 'Approved' | 'Rejected') => Promise<void>;
  addLeaveRequest: (lr: Omit<LeaveRequest, 'id'>) => Promise<void>;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  logAudit: (action: string, logType?: AuditLog['logType'], entityType?: string, entityId?: string) => Promise<void>;
  currentView: string;
  setCurrentView: (v: string) => void;
  currentUser: { name: string; role: 'Admin' | 'HR' | 'Employee'; avatar: string };
  setCurrentUser: (u: any) => void;
}

export interface PayrollCycle {
  month: string;
  status: 'Not Started' | 'Processed' | 'Partially Paid' | 'Paid';
  activeEmployees: number;
  totalRecords: number;
  pendingRecords: number;
  paidRecords: number;
  canGenerate: boolean;
  canApprove: boolean;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);
const API_BASE = import.meta.env.VITE_API_URL || '';
const currentMonth = () => new Date().toISOString().slice(0, 7);

const parseJsonResponse = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const fetchJson = async (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken');
  const hasFormDataBody = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(hasFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await parseJsonResponse(res);
  if (!res.ok) {
    const errorMessage = typeof body === 'string' ? body : body?.error || 'API request failed';
    const error = new Error(errorMessage) as Error & { status?: number; data?: unknown };
    error.status = res.status;
    error.data = typeof body === 'string' ? undefined : body?.data;
    throw error;
  }
  return body;
};

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [payrollCycle, setPayrollCycle] = useState<PayrollCycle | null>(null);
  const [payrollCycleLoading, setPayrollCycleLoading] = useState(false);
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState(currentMonth());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState({
    name: 'Alex Morgan',
    role: 'Admin' as const,
    avatar: 'https://i.pravatar.cc/150?img=12',
  });

  useEffect(() => {
    if (!user) return;
    setCurrentUser({
      name: user.name,
      role: user.role,
      avatar: user.avatar || 'https://i.pravatar.cc/150?img=12',
    });
  }, [user]);

  const logAudit = useCallback(async (action: string, logType: AuditLog['logType'] = 'info', entityType?: string, entityId?: string) => {
    try {
      const result = await fetchJson('/api/audit-logs', {
        method: 'POST',
        body: JSON.stringify({ action, user_name: currentUser.name, log_type: logType, entity_type: entityType, entity_id: entityId }),
      });
      if (result.data) setAuditLogs(prev => [dbToAudit(result.data), ...prev]);
    } catch (error) {
      console.error('Audit log failed', error);
    }
  }, [currentUser.name]);

  const refreshPayrollCycle = useCallback(async (month = selectedPayrollMonth) => {
    if (!user || user.role === 'Employee') {
      setPayrollCycle(null);
      return;
    }
    setPayrollCycleLoading(true);
    try {
      const result = await fetchJson(`/api/payroll/cycle-status?month=${encodeURIComponent(month)}`);
      if (result.data) setPayrollCycle(result.data);
    } catch (error) {
      console.error('Payroll cycle refresh failed', error);
    } finally {
      setPayrollCycleLoading(false);
    }
  }, [selectedPayrollMonth, user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [
        fetchJson('/api/employees'),
        fetchJson('/api/payroll'),
        fetchJson('/api/leave-requests'),
        fetchJson('/api/attendance'),
        user?.role === 'Employee' ? Promise.resolve({ data: [] }) : fetchJson('/api/audit-logs'),
      ];
      const [empRes, payRes, leaveRes, attRes, auditRes] = await Promise.all(requests);
      if (empRes.data) setEmployees(empRes.data.map(dbToEmployee));
      if (payRes.data) setPayrollRecords(payRes.data.map(dbToPayroll));
      if (leaveRes.data) setLeaveRequests(leaveRes.data.map(dbToLeave));
      if (attRes.data) setAttendance(attRes.data.map(dbToAttendance));
      if (auditRes.data) setAuditLogs(auditRes.data.map(dbToAudit));
    } catch (error) {
      console.error('Refresh failed', error);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshPayrollCycle(selectedPayrollMonth);
  }, [refreshPayrollCycle, selectedPayrollMonth]);

  const addEmployee = async (emp: Omit<Employee, 'id'>) => {
    try {
      const payload = employeeToDb(emp);
      const result = await fetchJson('/api/employees', { method: 'POST', body: JSON.stringify(payload) });
      if (result.data) {
        setEmployees(prev => [dbToEmployee(result.data), ...prev]);
        await logAudit(`Employee added: ${result.data.name}`, 'success', 'employee', result.data.id);
      }
      return result.data ? dbToEmployee(result.data) : null;
    } catch (error) {
      console.error('Add employee failed', error);
      throw error;
    }
  };

  const updateEmployee = async (id: string, emp: Partial<Employee>) => {
    try {
      const payload = employeeToDb(emp);
      const result = await fetchJson(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (result.data) {
        setEmployees(prev => prev.map(e => e.id === id ? dbToEmployee(result.data) : e));
        await logAudit(`Employee updated: ${result.data.name}`, 'info', 'employee', id);
      }
    } catch (error) {
      console.error('Update employee failed', error);
      throw error;
    }
  };

  const uploadEmployeePhoto = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const result = await fetchJson(`/api/employees/${id}/photo`, { method: 'POST', body: formData });
      if (result.data) {
        const employee = dbToEmployee(result.data);
        setEmployees(prev => prev.map(e => e.id === id ? employee : e));
        await logAudit(`Employee photo uploaded: ${result.data.name}`, 'info', 'employee', id);
        return employee;
      }
      return null;
    } catch (error) {
      console.error('Upload employee photo failed', error);
      throw error;
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      const emp = employees.find(e => e.id === id);
      await fetchJson(`/api/employees/${id}`, { method: 'DELETE' });
      setEmployees(prev => prev.filter(e => e.id !== id));
      await logAudit(`Employee deleted: ${emp?.name || id}`, 'warning', 'employee', id);
    } catch (error) {
      console.error('Delete employee failed', error);
    }
  };

  const runPayroll = async (month = selectedPayrollMonth) => {
    try {
      const active = employees.filter(e => e.status === 'Active');
      const result = await fetchJson('/api/payroll/generate', { method: 'POST', body: JSON.stringify({ month }) });
      const created = result.data ? result.data.map(dbToPayroll) : [];
      if (result.data) {
        setPayrollRecords(prev => [...created, ...prev]);
        await logAudit(`Payroll processed for ${month} (${active.length} employees)`, 'success', 'payroll');
      }
      await refreshPayrollCycle(month);
      return created;
    } catch (error) {
      console.error('Run payroll failed', error);
      throw error;
    }
  };

  const approvePayroll = async (id: string) => {
    try {
      const result = await fetchJson(`/api/payroll-records/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Paid' }) });
      if (result.data) {
        setPayrollRecords(prev => prev.map(p => p.id === id ? dbToPayroll(result.data) : p));
        await logAudit(`Payslip approved: ${id}`, 'success', 'payroll', id);
        await refreshPayrollCycle(result.data.month);
      }
    } catch (error) {
      console.error('Approve payroll failed', error);
      throw error;
    }
  };

  const approveLeave = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      const result = await fetchJson(`/api/leave-requests/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      if (result.data) {
        setLeaveRequests(prev => prev.map(l => l.id === id ? dbToLeave(result.data) : l));
        await logAudit(`Leave request ${status.toLowerCase()}`, status === 'Approved' ? 'success' : 'warning', 'leave', id);
      }
    } catch (error) {
      console.error('Approve leave failed', error);
      throw error;
    }
  };

  const addLeaveRequest = async (lr: Omit<LeaveRequest, 'id'>) => {
    try {
      const payload = {
        employee_id: lr.employeeId,
        type: lr.type,
        start_date: lr.startDate,
        end_date: lr.endDate,
        days: lr.days,
        reason: lr.reason,
        status: lr.status,
      };
      const result = await fetchJson('/api/leave-requests', { method: 'POST', body: JSON.stringify(payload) });
      if (result.data) {
        setLeaveRequests(prev => [dbToLeave(result.data), ...prev]);
        await logAudit('Leave request submitted', 'info', 'leave', result.data.id);
      }
    } catch (error) {
      console.error('Add leave request failed', error);
      throw error;
    }
  };

  const clockIn = async () => {
    try {
      const result = await fetchJson('/api/attendance/clock-in', { method: 'POST', body: JSON.stringify({}) });
      if (result.data) {
        setAttendance(prev => [dbToAttendance(result.data), ...prev]);
        await logAudit('Clocked in', 'success', 'attendance', result.data.id);
      }
    } catch (error) {
      console.error('Clock in failed', error);
      throw error;
    }
  };

  const clockOut = async () => {
    try {
      const result = await fetchJson('/api/attendance/clock-out', { method: 'POST', body: JSON.stringify({}) });
      if (result.data) {
        setAttendance(prev => prev.map(a => a.id === result.data.id ? dbToAttendance(result.data) : a));
        await logAudit('Clocked out', 'success', 'attendance', result.data.id);
      }
    } catch (error) {
      console.error('Clock out failed', error);
      throw error;
    }
  };

  const value = useMemo(() => ({
    employees, payrollRecords, payrollCycle, payrollCycleLoading, selectedPayrollMonth,
    leaveRequests, attendance, auditLogs, loading,
    refresh, addEmployee, updateEmployee, uploadEmployeePhoto, deleteEmployee,
    setSelectedPayrollMonth, refreshPayrollCycle, runPayroll, approvePayroll,
    approveLeave, addLeaveRequest, clockIn, clockOut, logAudit,
    currentView, setCurrentView, currentUser, setCurrentUser,
  }), [
    employees, payrollRecords, payrollCycle, payrollCycleLoading, selectedPayrollMonth,
    leaveRequests, attendance, auditLogs, loading, currentView, currentUser,
    refresh, refreshPayrollCycle, logAudit,
  ]);

  return <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>;
};

export const usePayroll = () => {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error('usePayroll must be used within PayrollProvider');
  return ctx;
};
