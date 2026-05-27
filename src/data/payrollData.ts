export interface Employee {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: 'Admin' | 'HR' | 'Employee';
  idNumber: string;
  department: string;
  position: string;
  basicSalary: number;
  allowances: number;
  bankName: string;
  bankAccount: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  joinDate: string;
  avatar: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string;
  basicSalary: number;
  allowances: number;
  overtime: number;
  bonus: number;
  grossSalary: number;
  paye: number;
  nssf: number;
  nhif: number;
  pension: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  status: 'Paid' | 'Pending' | 'Processing';
  paymentDate: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  status: 'Present' | 'Late' | 'Absent';
}

export interface AuditLog {
  id: number;
  action: string;
  userName: string;
  entityType?: string;
  entityId?: string;
  logType: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

// Mappers between DB (snake_case) and TS (camelCase)
export const dbToEmployee = (r: any): Employee => ({
  id: r.id,
  name: r.name,
  email: r.email,
  password: r.password,
  role: r.role,
  idNumber: r.id_number || '',
  department: r.department,
  position: r.position,
  basicSalary: Number(r.basic_salary),
  allowances: Number(r.allowances),
  bankName: r.bank_name || '',
  bankAccount: r.bank_account || '',
  status: r.status,
  joinDate: r.join_date,
  avatar: r.avatar || '',
});

export const employeeToDb = (e: Partial<Employee>) => ({
  ...(e.id !== undefined && { id: e.id }),
  ...(e.name !== undefined && { name: e.name }),
  ...(e.email !== undefined && { email: e.email }),
  ...(e.password !== undefined && { password: e.password }),
  ...(e.role !== undefined && { role: e.role }),
  ...(e.idNumber !== undefined && { id_number: e.idNumber }),
  ...(e.department !== undefined && { department: e.department }),
  ...(e.position !== undefined && { position: e.position }),
  ...(e.basicSalary !== undefined && { basic_salary: e.basicSalary }),
  ...(e.allowances !== undefined && { allowances: e.allowances }),
  ...(e.bankName !== undefined && { bank_name: e.bankName }),
  ...(e.bankAccount !== undefined && { bank_account: e.bankAccount }),
  ...(e.status !== undefined && { status: e.status }),
  ...(e.joinDate !== undefined && { join_date: e.joinDate }),
  ...(e.avatar !== undefined && { avatar: e.avatar }),
});

export const dbToPayroll = (r: any): PayrollRecord => ({
  id: r.id,
  employeeId: r.employee_id,
  month: r.month,
  basicSalary: Number(r.basic_salary),
  allowances: Number(r.allowances),
  overtime: Number(r.overtime),
  bonus: Number(r.bonus),
  grossSalary: Number(r.gross_salary),
  paye: Number(r.paye),
  nssf: Number(r.nssf),
  nhif: Number(r.nhif),
  pension: Number(r.pension),
  otherDeductions: Number(r.other_deductions),
  totalDeductions: Number(r.total_deductions),
  netSalary: Number(r.net_salary),
  status: r.status,
  paymentDate: r.payment_date,
});

export const dbToLeave = (r: any): LeaveRequest => ({
  id: r.id,
  employeeId: r.employee_id,
  type: r.type,
  startDate: r.start_date,
  endDate: r.end_date,
  days: r.days,
  reason: r.reason || '',
  status: r.status,
});

export const dbToAttendance = (r: any): AttendanceRecord => ({
  id: r.id,
  employeeId: r.employee_id,
  date: r.date,
  checkIn: r.check_in || '',
  checkOut: r.check_out || '',
  hours: Number(r.hours),
  status: r.status,
});

export const dbToAudit = (r: any): AuditLog => ({
  id: r.id,
  action: r.action,
  userName: r.user_name || 'System',
  entityType: r.entity_type,
  entityId: r.entity_id,
  logType: r.log_type,
  createdAt: r.created_at,
});

// PAYE Tax brackets (Kenya 2024)
export function calculatePAYE(taxableIncome: number): number {
  let tax = 0;
  if (taxableIncome <= 24000) {
    tax = taxableIncome * 0.10;
  } else if (taxableIncome <= 32333) {
    tax = 2400 + (taxableIncome - 24000) * 0.25;
  } else if (taxableIncome <= 500000) {
    tax = 2400 + 2083.25 + (taxableIncome - 32333) * 0.30;
  } else if (taxableIncome <= 800000) {
    tax = 2400 + 2083.25 + 140300.10 + (taxableIncome - 500000) * 0.325;
  } else {
    tax = 2400 + 2083.25 + 140300.10 + 97500 + (taxableIncome - 800000) * 0.35;
  }
  const personalRelief = 2400;
  return Math.max(0, tax - personalRelief);
}

export function calculateNSSF(salary: number): number {
  const pensionable = Math.min(salary, 72000);
  return Math.round(pensionable * 0.06);
}

export function calculateNHIF(salary: number): number {
  return Math.round(salary * 0.0275);
}

export function calculatePension(salary: number): number {
  return Math.round(salary * 0.05);
}

export function processPayroll(employee: Employee, overtime = 0, bonus = 0, otherDeductions = 0): PayrollRecord {
  const grossSalary = employee.basicSalary + employee.allowances + overtime + bonus;
  const nssf = calculateNSSF(employee.basicSalary);
  const taxableIncome = grossSalary - nssf;
  const paye = Math.round(calculatePAYE(taxableIncome));
  const nhif = calculateNHIF(grossSalary);
  const pension = calculatePension(employee.basicSalary);
  const totalDeductions = paye + nssf + nhif + pension + otherDeductions;
  const netSalary = grossSalary - totalDeductions;

  return {
    id: `PAY-${employee.id}-${Date.now()}`,
    employeeId: employee.id,
    month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    basicSalary: employee.basicSalary,
    allowances: employee.allowances,
    overtime,
    bonus,
    grossSalary,
    paye,
    nssf,
    nhif,
    pension,
    otherDeductions,
    totalDeductions,
    netSalary,
    status: 'Pending',
    paymentDate: new Date().toISOString().split('T')[0],
  };
}

export const payrollToDb = (p: PayrollRecord) => ({
  id: p.id,
  employee_id: p.employeeId,
  month: p.month,
  basic_salary: p.basicSalary,
  allowances: p.allowances,
  overtime: p.overtime,
  bonus: p.bonus,
  gross_salary: p.grossSalary,
  paye: p.paye,
  nssf: p.nssf,
  nhif: p.nhif,
  pension: p.pension,
  other_deductions: p.otherDeductions,
  total_deductions: p.totalDeductions,
  net_salary: p.netSalary,
  status: p.status,
  payment_date: p.paymentDate,
});

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Legacy stub - no longer used; data comes from DB
export function generateEmployees(): Employee[] {
  return [];
}
