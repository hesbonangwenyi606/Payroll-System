import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const connectionString = process.env.DATABASE_URL || '';
const jwtSecret = process.env.JWT_SECRET || 'dev-payroll-secret-change-me';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';
const requireDatabase = process.env.REQUIRE_DATABASE === 'true';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadRoot, { recursive: true });

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

const isPlaceholderDatabaseUrl = (url) =>
  !url || /user:password|username:password/.test(url);

let dbReady = false;
const fallbackPasswordHash = bcrypt.hashSync('password123', 10);

const defaultSettings = {
  company: {
    name: 'PayrollPro Inc.',
    taxPin: 'P051234567K',
    address: '123 Business Park, Nairobi',
    email: 'info@payrollpro.co.ke',
    phone: '+254 700 000 000',
    currency: 'KES',
    payCycle: 'Monthly',
  },
  payroll: {
    nssfRate: 6,
    shifRate: 2.75,
    pensionRate: 5,
    personalRelief: 2400,
    overtimeRate: 1.5,
    nssfCap: 72000,
    workDayHours: 8,
    payrollApprovalRequired: true,
  },
  notifications: {
    autoEmailPayslips: true,
    salaryPaymentAlerts: true,
    payrollApprovalAlerts: true,
    taxDeadlineReminders: true,
    dailyAttendanceSummary: false,
    leaveRequestAlerts: true,
  },
  integrations: {
    bankGateway: false,
    accountingSoftware: false,
    biometricAttendance: false,
    kraItax: false,
  },
};

let fallbackSettings = JSON.parse(JSON.stringify(defaultSettings));

const employees = [
  {
    id: 'EMP0001',
    name: 'Alice Johnson',
    email: 'admin@example.com',
    password: 'password123',
    role: 'Admin',
    id_number: 'A1234567',
    department: 'Finance',
    position: 'Payroll Manager',
    basic_salary: 70000,
    allowances: 12000,
    bank_name: 'Equity Bank',
    bank_account: '1234567890',
    status: 'Active',
    join_date: '2023-01-15',
    avatar: 'https://i.pravatar.cc/150?img=12',
    created_at: new Date().toISOString(),
  },
  {
    id: 'EMP0002',
    name: 'Marcus Reed',
    email: 'hr@example.com',
    password: 'password123',
    role: 'HR',
    id_number: 'B2345678',
    department: 'Human Resources',
    position: 'HR Specialist',
    basic_salary: 54000,
    allowances: 8000,
    bank_name: 'KCB Bank',
    bank_account: '2345678901',
    status: 'Active',
    join_date: '2024-03-21',
    avatar: 'https://i.pravatar.cc/150?img=34',
    created_at: new Date().toISOString(),
  },
  {
    id: 'EMP0003',
    name: 'Tina Patel',
    email: 'employee@example.com',
    password: 'password123',
    role: 'Employee',
    id_number: 'C3456789',
    department: 'Accounting',
    position: 'Senior Accountant',
    basic_salary: 65000,
    allowances: 9000,
    bank_name: 'Stanbic Bank',
    bank_account: '3456789012',
    status: 'On Leave',
    join_date: '2022-05-09',
    avatar: 'https://i.pravatar.cc/150?img=56',
    created_at: new Date().toISOString(),
  },
];

const payrollRecords = [
  {
    id: 'PAY-EMP0003-001',
    employee_id: 'EMP0003',
    month: '2026-05',
    basic_salary: 65000,
    allowances: 9000,
    overtime: 1200,
    bonus: 500,
    gross_salary: 75700,
    paye: 9084,
    nssf: 2271,
    nhif: 1700,
    pension: 1514,
    other_deductions: 650,
    total_deductions: 13519,
    net_salary: 62181,
    status: 'Paid',
    payment_date: '2026-05-28',
    created_at: new Date().toISOString(),
  },
];

const leaveRequests = [
  {
    id: 'LV-EMP0003-001',
    employee_id: 'EMP0003',
    type: 'Annual Leave',
    start_date: '2026-06-01',
    end_date: '2026-06-10',
    days: 8,
    reason: 'Family travel',
    status: 'Pending',
    created_at: new Date().toISOString(),
  },
];

const attendance = [
  {
    id: 'AT-EMP0003-001',
    employee_id: 'EMP0003',
    date: '2026-05-20',
    check_in: '08:10',
    check_out: '17:00',
    hours: 8,
    status: 'Present',
  },
];

const auditLogs = [
  {
    id: 1,
    action: 'System initialized',
    user_name: 'System',
    entity_type: 'system',
    entity_id: null,
    log_type: 'info',
    created_at: new Date().toISOString(),
  },
];

const users = employees.map((employee) => ({
  id: `USR-${employee.id}`,
  name: employee.name,
  email: employee.email,
  password_hash: fallbackPasswordHash,
  role: employee.role,
  employee_id: employee.id,
  avatar: employee.avatar,
  department: employee.department,
  position: employee.position,
  created_at: new Date().toISOString(),
}));

const getNextId = (prefix, collection) => {
  const ids = collection
    .map((item) => item.id)
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.replace(/[^0-9]/g, '')))
    .filter(Number.isFinite);
  const max = ids.length ? Math.max(...ids) : 0;
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
};

const sanitizeEmployee = (employee) => {
  const { password, ...rest } = employee;
  return rest;
};

const publicUserFields = `
  users.id,
  users.name,
  users.email,
  users.role,
  users.employee_id,
  employees.avatar,
  employees.department,
  employees.position
`;

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  employeeId: user.employee_id,
  avatar: user.avatar || '',
  department: user.department || '',
  position: user.position || '',
});

const signToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

const authResponse = (user) => {
  const safeUser = sanitizeUser(user);
  return {
    data: safeUser,
    token: signToken(user),
  };
};

const findFallbackUserByEmail = (email) =>
  users.find((user) => user.email.toLowerCase() === String(email || '').toLowerCase());

const findFallbackUserById = (id) =>
  users.find((user) => user.id === id);

const getUserById = async (id) => {
  if (dbReady) {
    const result = await dbQuery(
      `SELECT ${publicUserFields}
       FROM users
       LEFT JOIN employees ON employees.id = users.employee_id
       WHERE users.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
  return findFallbackUserById(id) || null;
};

const authenticateToken = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }
    req.user = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  next();
};

const canAccessEmployee = (req, employeeId) =>
  req.user?.role === 'Admin' || req.user?.role === 'HR' || req.user?.employeeId === employeeId;

const getNextEmployeeId = async () => {
  if (dbReady) {
    const result = await dbQuery(`
      SELECT COALESCE(MAX((regexp_replace(id, '[^0-9]', '', 'g'))::int), 0) AS max_id
      FROM employees
      WHERE id LIKE 'EMP%'
    `);
    return `EMP${String(Number(result.rows[0]?.max_id || 0) + 1).padStart(4, '0')}`;
  }
  return getNextId('EMP', employees);
};

const buildUpdatePayload = (body, allowedFields) => {
  const fields = Object.keys(body).filter((field) => allowedFields.includes(field));
  const values = fields.map((field) => body[field]);
  return { fields, values };
};

const calculatePAYE = (taxableIncome) => {
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
  return Math.max(0, tax - 2400);
};

const calculatePayrollRecord = (employee, { month, overtime = 0, bonus = 0, otherDeductions = 0 } = {}) => {
  const basicSalary = Number(employee.basic_salary || employee.basicSalary || 0);
  const allowances = Number(employee.allowances || 0);
  const grossSalary = basicSalary + allowances + Number(overtime) + Number(bonus);
  const nssf = Math.round(Math.min(basicSalary, 72000) * 0.06);
  const paye = Math.round(calculatePAYE(grossSalary - nssf));
  const nhif = Math.round(grossSalary * 0.0275);
  const pension = Math.round(basicSalary * 0.05);
  const totalDeductions = paye + nssf + nhif + pension + Number(otherDeductions);

  return {
    id: `PAY-${employee.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    employee_id: employee.id,
    month: month || new Date().toISOString().slice(0, 7),
    basic_salary: basicSalary,
    allowances,
    overtime: Number(overtime),
    bonus: Number(bonus),
    gross_salary: grossSalary,
    paye,
    nssf,
    nhif,
    pension,
    other_deductions: Number(otherDeductions),
    total_deductions: totalDeductions,
    net_salary: grossSalary - totalDeductions,
    status: 'Pending',
    payment_date: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  };
};

const currentPayrollMonth = () => new Date().toISOString().slice(0, 7);

const buildPayrollCycleStatus = async (month = currentPayrollMonth()) => {
  if (dbReady) {
    const [recordResult, employeeResult] = await Promise.all([
      dbQuery(
        `SELECT
           COUNT(*)::int AS total_records,
           COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_records,
           COUNT(*) FILTER (WHERE status = 'Paid')::int AS paid_records
         FROM payroll_records
         WHERE month = $1`,
        [month]
      ),
      dbQuery(`SELECT COUNT(*)::int AS active_employees FROM employees WHERE status = 'Active'`),
    ]);
    const counts = recordResult.rows[0] || {};
    const totalRecords = Number(counts.total_records || 0);
    const pendingRecords = Number(counts.pending_records || 0);
    const paidRecords = Number(counts.paid_records || 0);
    const activeEmployees = Number(employeeResult.rows[0]?.active_employees || 0);
    const status = totalRecords === 0
      ? 'Not Started'
      : pendingRecords === 0 && paidRecords === totalRecords
        ? 'Paid'
        : paidRecords > 0
          ? 'Partially Paid'
          : 'Processed';

    return {
      month,
      status,
      activeEmployees,
      totalRecords,
      pendingRecords,
      paidRecords,
      canGenerate: totalRecords === 0 && activeEmployees > 0,
      canApprove: pendingRecords > 0,
    };
  }

  const monthRecords = payrollRecords.filter((record) => record.month === month);
  const activeEmployees = employees.filter((employee) => employee.status === 'Active').length;
  const totalRecords = monthRecords.length;
  const pendingRecords = monthRecords.filter((record) => record.status === 'Pending').length;
  const paidRecords = monthRecords.filter((record) => record.status === 'Paid').length;
  const status = totalRecords === 0
    ? 'Not Started'
    : pendingRecords === 0 && paidRecords === totalRecords
      ? 'Paid'
      : paidRecords > 0
        ? 'Partially Paid'
        : 'Processed';

  return {
    month,
    status,
    activeEmployees,
    totalRecords,
    pendingRecords,
    paidRecords,
    canGenerate: totalRecords === 0 && activeEmployees > 0,
    canApprove: pendingRecords > 0,
  };
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(uploadRoot, req.params.id || 'general');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const getTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendNotificationEmail = async ({ to, subject, text }) => {
  const transporter = getTransporter();
  if (!transporter || !to) {
    return { skipped: true, reason: 'Email service is not configured.' };
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
  return { skipped: false };
};

const mergeSettings = (base, updates) => ({
  ...base,
  ...updates,
  company: { ...base.company, ...(updates?.company || {}) },
  payroll: { ...base.payroll, ...(updates?.payroll || {}) },
  notifications: { ...base.notifications, ...(updates?.notifications || {}) },
  integrations: { ...base.integrations, ...(updates?.integrations || {}) },
});

const getAppSettings = async () => {
  if (dbReady) {
    const result = await dbQuery('SELECT settings FROM app_settings WHERE id = $1', ['default']);
    if (!result.rows.length) return defaultSettings;
    return mergeSettings(defaultSettings, result.rows[0].settings || {});
  }
  return mergeSettings(defaultSettings, fallbackSettings);
};

const saveAppSettings = async (updates) => {
  const merged = mergeSettings(await getAppSettings(), updates);
  if (dbReady) {
    await dbQuery(
      `INSERT INTO app_settings (id, settings, updated_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at`,
      ['default', JSON.stringify(merged), new Date().toISOString()]
    );
  } else {
    fallbackSettings = merged;
  }
  return merged;
};

const publicFileUrl = (req, employeeId, filename) =>
  `${req.protocol}://${req.get('host')}/uploads/${employeeId}/${filename}`;

const pipePayslipPdf = (res, payroll, employee) => {
  const doc = new PDFDocument({ margin: 48 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${employee.id}-${payroll.month}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text('PayrollPro Payslip', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text(`Employee: ${employee.name}`);
  doc.text(`Employee ID: ${employee.id}`);
  doc.text(`Department: ${employee.department || 'N/A'}`);
  doc.text(`Period: ${payroll.month}`);
  doc.moveDown();
  doc.fontSize(14).text('Earnings');
  doc.fontSize(11).text(`Basic Salary: KES ${Number(payroll.basic_salary).toLocaleString()}`);
  doc.text(`Allowances: KES ${Number(payroll.allowances).toLocaleString()}`);
  doc.text(`Overtime: KES ${Number(payroll.overtime).toLocaleString()}`);
  doc.text(`Bonus: KES ${Number(payroll.bonus).toLocaleString()}`);
  doc.text(`Gross Salary: KES ${Number(payroll.gross_salary).toLocaleString()}`);
  doc.moveDown();
  doc.fontSize(14).text('Deductions');
  doc.fontSize(11).text(`PAYE: KES ${Number(payroll.paye).toLocaleString()}`);
  doc.text(`NSSF: KES ${Number(payroll.nssf).toLocaleString()}`);
  doc.text(`SHIF/NHIF: KES ${Number(payroll.nhif).toLocaleString()}`);
  doc.text(`Pension: KES ${Number(payroll.pension).toLocaleString()}`);
  doc.text(`Other Deductions: KES ${Number(payroll.other_deductions).toLocaleString()}`);
  doc.text(`Total Deductions: KES ${Number(payroll.total_deductions).toLocaleString()}`);
  doc.moveDown();
  doc.fontSize(16).text(`Net Pay: KES ${Number(payroll.net_salary).toLocaleString()}`);
  doc.moveDown();
  doc.fontSize(9).text('This is a computer-generated payslip and does not require a signature.', { align: 'center' });
  doc.end();
};

const reportMonthToDate = (month) => {
  const [year, monthIndex] = String(month || currentPayrollMonth()).split('-').map(Number);
  return new Date(year, monthIndex - 1, 1);
};

const isInReportPeriod = (valueMonth, selectedMonth, period) => {
  if (period === 'all') return true;
  const target = reportMonthToDate(valueMonth);
  const selected = reportMonthToDate(selectedMonth);
  if (period === 'year') return target.getFullYear() === selected.getFullYear();
  if (period === 'quarter') {
    return target.getFullYear() === selected.getFullYear()
      && Math.floor(target.getMonth() / 3) === Math.floor(selected.getMonth() / 3);
  }
  return String(valueMonth) === String(selectedMonth);
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const reportFileName = (title, month) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${month || currentPayrollMonth()}`;

const buildReportExport = async ({ reportId, period = 'month', month = currentPayrollMonth() }) => {
  const sourceEmployees = dbReady
    ? (await dbQuery('SELECT * FROM employees')).rows
    : employees;
  const sourcePayroll = dbReady
    ? (await dbQuery('SELECT * FROM payroll_records')).rows
    : payrollRecords;
  const sourceAttendance = dbReady
    ? (await dbQuery('SELECT * FROM attendance')).rows
    : attendance;
  const sourceLeave = dbReady
    ? (await dbQuery('SELECT * FROM leave_requests')).rows
    : leaveRequests;

  const scopedPayroll = sourcePayroll.filter((record) => isInReportPeriod(record.month, month, period));
  const employeeById = sourceEmployees.reduce((acc, employee) => {
    acc[employee.id] = employee;
    return acc;
  }, {});
  const scopedAttendance = sourceAttendance.filter((record) => isInReportPeriod(String(record.date || '').slice(0, 7), month, period));
  const scopedLeave = sourceLeave.filter((request) => isInReportPeriod(String(request.start_date || request.startDate || '').slice(0, 7), month, period));

  if (reportId === 'tax-deductions') {
    return {
      title: 'Tax & Statutory Deductions',
      headers: ['Payroll ID', 'Employee ID', 'Month', 'PAYE', 'NSSF', 'SHIF/NHIF', 'Pension', 'Other', 'Total Deductions'],
      rows: scopedPayroll.map((record) => [
        record.id, record.employee_id, record.month, Number(record.paye || 0), Number(record.nssf || 0),
        Number(record.nhif || 0), Number(record.pension || 0), Number(record.other_deductions || 0),
        Number(record.total_deductions || 0),
      ]),
    };
  }

  if (reportId === 'department-costs') {
    const payrollByEmployee = scopedPayroll.reduce((acc, record) => {
      acc[record.employee_id] = (acc[record.employee_id] || 0) + Number(record.net_salary || 0);
      return acc;
    }, {});
    const departments = sourceEmployees.reduce((acc, employee) => {
      const department = employee.department || 'Unassigned';
      if (!acc[department]) acc[department] = { count: 0, baseSalary: 0, netPayroll: 0 };
      acc[department].count += 1;
      acc[department].baseSalary += Number(employee.basic_salary || 0);
      acc[department].netPayroll += Number(payrollByEmployee[employee.id] || 0);
      return acc;
    }, {});
    return {
      title: 'Department Cost Analysis',
      headers: ['Department', 'Headcount', 'Base Salary', 'Net Payroll'],
      rows: Object.entries(departments).map(([department, data]) => [
        department, data.count, data.baseSalary, data.netPayroll,
      ]),
    };
  }

  if (reportId === 'bank-file') {
    return {
      title: 'Bank Payment File',
      headers: ['Employee ID', 'Employee', 'Bank', 'Account', 'Month', 'Net Pay', 'Status'],
      rows: scopedPayroll.map((record) => {
        const employee = employeeById[record.employee_id] || {};
        return [
          record.employee_id,
          employee.name || 'Unknown',
          employee.bank_name || '',
          employee.bank_account || '',
          record.month,
          Number(record.net_salary || 0),
          record.status || '',
        ];
      }),
    };
  }

  if (reportId === 'employee-history') {
    return {
      title: 'Employee Payment History',
      headers: ['Employee ID', 'Employee', 'Department', 'Month', 'Gross', 'Deductions', 'Net Pay', 'Status'],
      rows: scopedPayroll.map((record) => {
        const employee = employeeById[record.employee_id] || {};
        return [
          record.employee_id,
          employee.name || 'Unknown',
          employee.department || '',
          record.month,
          Number(record.gross_salary || 0),
          Number(record.total_deductions || 0),
          Number(record.net_salary || 0),
          record.status || '',
        ];
      }),
    };
  }

  if (reportId === 'attendance-leave') {
    return {
      title: 'Attendance & Leave Summary',
      headers: ['Metric', 'Value'],
      rows: [
        ['Present Records', scopedAttendance.filter((record) => record.status === 'Present').length],
        ['Late Records', scopedAttendance.filter((record) => record.status === 'Late').length],
        ['Absent Records', scopedAttendance.filter((record) => record.status === 'Absent').length],
        ['Worked Hours', scopedAttendance.reduce((sum, record) => sum + Number(record.hours || 0), 0)],
        ['Pending Leave', scopedLeave.filter((request) => request.status === 'Pending').length],
        ['Approved Leave', scopedLeave.filter((request) => request.status === 'Approved').length],
        ['Rejected Leave', scopedLeave.filter((request) => request.status === 'Rejected').length],
        ['Leave Days', scopedLeave.reduce((sum, request) => sum + Number(request.days || 0), 0)],
      ],
    };
  }

  return {
    title: 'Payroll Summary',
    headers: ['Payroll ID', 'Employee ID', 'Month', 'Gross', 'Deductions', 'Net Pay', 'Status', 'Payment Date'],
    rows: scopedPayroll.map((record) => [
      record.id,
      record.employee_id,
      record.month,
      Number(record.gross_salary || 0),
      Number(record.total_deductions || 0),
      Number(record.net_salary || 0),
      record.status || '',
      record.payment_date || '',
    ]),
  };
};

const sendReportPdf = (res, report, scopeLabel, filename) => {
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text(report.title, { continued: false });
  doc.moveDown(0.25);
  doc.fontSize(9).fillColor('#64748b').text(`Scope: ${scopeLabel} | Generated: ${new Date().toLocaleString()}`);
  doc.moveDown();
  doc.fillColor('#0f172a');

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = usableWidth / report.headers.length;
  let y = doc.y;

  const drawRow = (row, isHeader = false) => {
    const rowHeight = isHeader ? 22 : 28;
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    row.forEach((cell, index) => {
      doc
        .fontSize(isHeader ? 8 : 7)
        .fillColor(isHeader ? '#334155' : '#0f172a')
        .text(String(cell ?? ''), doc.page.margins.left + index * columnWidth, y, {
          width: columnWidth - 4,
          height: rowHeight,
          ellipsis: true,
        });
    });
    y += rowHeight;
  };

  drawRow(report.headers, true);
  report.rows.forEach((row) => drawRow(row));
  doc.end();
};

const sendReportExcel = (res, report, scopeLabel, filename) => {
  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <tr><th colspan="${report.headers.length}">${report.title}</th></tr>
          <tr><td colspan="${report.headers.length}">Scope: ${scopeLabel}</td></tr>
          <tr>${report.headers.map((header) => `<th>${header}</th>`).join('')}</tr>
          ${report.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}
        </table>
      </body>
    </html>
  `;
  res.setHeader('Content-Type', 'application/vnd.ms-excel;charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xls"`);
  res.send(html);
};

const sendReportCsv = (res, report, filename) => {
  const csv = [report.headers, ...report.rows].map((row) => row.map(csvCell).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv;charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(csv);
};

const initDatabase = async () => {
  if (!pool || isPlaceholderDatabaseUrl(connectionString)) {
    const message = 'PostgreSQL is not configured.';
    if (requireDatabase) {
      throw new Error(`${message} Set DATABASE_URL or disable REQUIRE_DATABASE.`);
    }
    console.info(`${message} Starting in fallback in-memory mode.`);
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id text PRIMARY KEY,
          name text UNIQUE NOT NULL,
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS employees (
          id text PRIMARY KEY,
          name text NOT NULL,
          email text UNIQUE NOT NULL,
          password text NOT NULL,
          role text NOT NULL,
          id_number text,
          department text,
          position text,
          basic_salary numeric,
          allowances numeric,
          bank_name text,
          bank_account text,
          status text,
          join_date date,
          avatar text,
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS users (
          id text PRIMARY KEY,
          name text NOT NULL,
          email text UNIQUE NOT NULL,
          password_hash text NOT NULL,
          role text NOT NULL CHECK (role IN ('Admin', 'HR', 'Employee')),
          employee_id text REFERENCES employees(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payroll_records (
          id text PRIMARY KEY,
          employee_id text REFERENCES employees(id) ON DELETE CASCADE,
          month text,
          basic_salary numeric,
          allowances numeric,
          overtime numeric,
          bonus numeric,
          gross_salary numeric,
          paye numeric,
          nssf numeric,
          nhif numeric,
          pension numeric,
          other_deductions numeric,
          total_deductions numeric,
          net_salary numeric,
          status text,
          payment_date date,
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS leave_requests (
          id text PRIMARY KEY,
          employee_id text REFERENCES employees(id) ON DELETE CASCADE,
          type text,
          start_date date,
          end_date date,
          days integer,
          reason text,
          status text,
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS attendance (
          id text PRIMARY KEY,
          employee_id text REFERENCES employees(id) ON DELETE CASCADE,
          date date,
          check_in text,
          check_out text,
          hours numeric,
          status text
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id serial PRIMARY KEY,
          action text,
          user_name text,
          entity_type text,
          entity_id text,
          log_type text DEFAULT 'info',
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payslips (
          id text PRIMARY KEY,
          employee_id text REFERENCES employees(id) ON DELETE CASCADE,
          period text,
          gross_pay numeric,
          net_pay numeric,
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS employee_documents (
          id text PRIMARY KEY,
          employee_id text REFERENCES employees(id) ON DELETE CASCADE,
          filename text NOT NULL,
          original_name text NOT NULL,
          file_url text NOT NULL,
          mime_type text,
          document_type text DEFAULT 'document',
          uploaded_by text,
          created_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          id text PRIMARY KEY,
          settings jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(
        `INSERT INTO app_settings (id, settings, updated_at)
         VALUES ($1,$2,$3)
         ON CONFLICT (id) DO NOTHING`,
        ['default', JSON.stringify(defaultSettings), new Date().toISOString()]
      );

      const hasEmployees = await client.query('SELECT 1 FROM employees LIMIT 1');
      if (!hasEmployees.rows.length) {
        await client.query(`
          INSERT INTO departments (id, name, created_at)
          VALUES
            ($1,$2,$3),
            ($4,$5,$6),
            ($7,$8,$9),
            ($10,$11,$12),
            ($13,$14,$15)
          ON CONFLICT (name) DO NOTHING
        `, [
          'DEP-FIN', 'Finance', new Date().toISOString(),
          'DEP-HR', 'Human Resources', new Date().toISOString(),
          'DEP-ACC', 'Accounting', new Date().toISOString(),
          'DEP-ENG', 'Engineering', new Date().toISOString(),
          'DEP-OPS', 'Operations', new Date().toISOString(),
        ]);

        await client.query(`
          INSERT INTO employees (id, name, email, password, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16),
            ($17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32),
            ($33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48)
        `, [
          'EMP0001', 'Alice Johnson', 'admin@example.com', 'password123', 'Admin', 'A1234567', 'Finance', 'Payroll Manager', 70000, 12000, 'Equity Bank', '1234567890', 'Active', '2023-01-15', 'https://i.pravatar.cc/150?img=12', new Date().toISOString(),
          'EMP0002', 'Marcus Reed', 'hr@example.com', 'password123', 'HR', 'B2345678', 'Human Resources', 'HR Specialist', 54000, 8000, 'KCB Bank', '2345678901', 'Active', '2024-03-21', 'https://i.pravatar.cc/150?img=34', new Date().toISOString(),
          'EMP0003', 'Tina Patel', 'employee@example.com', 'password123', 'Employee', 'C3456789', 'Accounting', 'Senior Accountant', 65000, 9000, 'Stanbic Bank', '3456789012', 'On Leave', '2022-05-09', 'https://i.pravatar.cc/150?img=56', new Date().toISOString(),
        ]);

        await client.query(`
          INSERT INTO payroll_records (id, employee_id, month, basic_salary, allowances, overtime, bonus, gross_salary, paye, nssf, nhif, pension, other_deductions, total_deductions, net_salary, status, payment_date, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        `, ['PAY-EMP0003-001', 'EMP0003', '2026-05', 65000, 9000, 1200, 500, 75700, 9084, 2271, 1700, 1514, 650, 13519, 62181, 'Paid', '2026-05-28', new Date().toISOString()]);

        await client.query(`
          INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, days, reason, status, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, ['LV-EMP0003-001', 'EMP0003', 'Annual Leave', '2026-06-01', '2026-06-10', 8, 'Family travel', 'Pending', new Date().toISOString()]);

        await client.query(`
          INSERT INTO attendance (id, employee_id, date, check_in, check_out, hours, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, ['AT-EMP0003-001', 'EMP0003', '2026-05-20', '08:10', '17:00', 8, 'Present']);

        await client.query(`
          INSERT INTO audit_logs (action, user_name, entity_type, entity_id, log_type, created_at)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, ['System initialized', 'System', 'system', null, 'info', new Date().toISOString()]);
      }

      const hasUsers = await client.query('SELECT 1 FROM users LIMIT 1');
      if (!hasUsers.rows.length) {
        const seededPasswordHash = await bcrypt.hash('password123', 10);
        await client.query(`
          INSERT INTO users (id, name, email, password_hash, role, employee_id, created_at)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7),
            ($8,$9,$10,$11,$12,$13,$14),
            ($15,$16,$17,$18,$19,$20,$21)
        `, [
          'USR-EMP0001', 'Alice Johnson', 'admin@example.com', seededPasswordHash, 'Admin', 'EMP0001', new Date().toISOString(),
          'USR-EMP0002', 'Marcus Reed', 'hr@example.com', seededPasswordHash, 'HR', 'EMP0002', new Date().toISOString(),
          'USR-EMP0003', 'Tina Patel', 'employee@example.com', seededPasswordHash, 'Employee', 'EMP0003', new Date().toISOString(),
        ]);
      }
    } finally {
      client.release();
    }

    dbReady = true;
    console.log('PostgreSQL database connected and initialized.');
  } catch (error) {
    dbReady = false;
    if (requireDatabase) {
      throw error;
    }
    console.warn('PostgreSQL initialization failed. Backend will use fallback in-memory data.', error.message);
  }
};

const dbQuery = async (text, params = []) => {
  if (!dbReady || !pool) {
    throw new Error('Database not available');
  }
  return pool.query(text, params);
};

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadRoot));

app.get('/', (req, res) => {
  res.json({ message: 'Payroll Salary System backend is running.' });
});

const handleLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (dbReady) {
      const result = await dbQuery(
        `SELECT users.*, employees.avatar, employees.department, employees.position
         FROM users
         LEFT JOIN employees ON employees.id = users.employee_id
         WHERE users.email = $1
         LIMIT 1`,
        [email]
      );
      if (!result.rows.length) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      return res.json(authResponse(user));
    }

    const user = findFallbackUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    return res.json(authResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed.' });
  }
};

app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'Employee', employeeId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const requestedRole = ['Admin', 'HR', 'Employee'].includes(role) ? role : 'Employee';
    const safeRole = req.user?.role === 'Admin' ? requestedRole : 'Employee';

    if (dbReady) {
      const existing = await dbQuery('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
      if (existing.rows.length) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await dbQuery(
        `INSERT INTO users (id, name, email, password_hash, role, employee_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, name, email, role, employee_id`,
        [randomUUID(), name, email, passwordHash, safeRole, employeeId || null, new Date().toISOString()]
      );
      return res.status(201).json(authResponse(result.rows[0]));
    }

    const existing = findFallbackUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    const user = {
      id: randomUUID(),
      name,
      email,
      password_hash: await bcrypt.hash(password, 10),
      role: safeRole,
      employee_id: employeeId || null,
      avatar: '',
      department: '',
      position: '',
      created_at: new Date().toISOString(),
    };
    users.push(user);
    return res.status(201).json(authResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ data: req.user });
});

app.get('/api/departments', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    if (dbReady) {
      const result = await dbQuery('SELECT * FROM departments ORDER BY name');
      return res.json({ data: result.rows });
    }
    const names = Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean)));
    return res.json({ data: names.map((name) => ({ id: `DEP-${name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`, name })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch departments.' });
  }
});

app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (dbReady) {
      const result = req.user.role === 'Employee'
        ? await dbQuery('SELECT id, name, email, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at FROM employees WHERE id = $1 ORDER BY name', [req.user.employeeId])
        : await dbQuery('SELECT id, name, email, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at FROM employees ORDER BY name');
      return res.json({ data: result.rows });
    }
    const visibleEmployees = req.user.role === 'Employee'
      ? employees.filter((emp) => emp.id === req.user.employeeId)
      : employees;
    return res.json({ data: visibleEmployees.map(sanitizeEmployee) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch employees.' });
  }
});

app.get('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (!canAccessEmployee(req, req.params.id)) {
      return res.status(403).json({ error: 'You do not have permission to view this employee.' });
    }
    if (dbReady) {
      const result = await dbQuery('SELECT id, name, email, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at FROM employees WHERE id = $1', [req.params.id]);
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Employee not found.' });
      }
      return res.json({ data: result.rows[0] });
    }

    const employee = employees.find((emp) => emp.id === req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    return res.json({ data: sanitizeEmployee(employee) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch employee.' });
  }
});

app.post('/api/employees', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const payload = req.body;
    const employeePassword = payload.password || 'password123';
    const employeeRole = payload.role || 'Employee';
    if (dbReady) {
      const id = await getNextEmployeeId();
      const createdAt = new Date().toISOString();
      const result = await dbQuery(
        `INSERT INTO employees (id, name, email, password, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          RETURNING id, name, email, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at`,
        [
          id,
          payload.name,
          payload.email,
          employeePassword,
          employeeRole,
          payload.id_number,
          payload.department,
          payload.position,
          payload.basic_salary,
          payload.allowances,
          payload.bank_name,
          payload.bank_account,
          payload.status,
          payload.join_date,
          payload.avatar,
          createdAt,
        ]
      );
      const passwordHash = await bcrypt.hash(employeePassword, 10);
      await dbQuery(
        `INSERT INTO users (id, name, email, password_hash, role, employee_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (email) DO NOTHING`,
        [randomUUID(), payload.name, payload.email, passwordHash, employeeRole, id, createdAt]
      );
      return res.status(201).json({ data: result.rows[0] });
    }

    const newEmployee = {
      id: await getNextEmployeeId(),
      ...payload,
      password: employeePassword,
      role: employeeRole,
      created_at: new Date().toISOString(),
    };
    employees.unshift(newEmployee);
    users.push({
      id: `USR-${newEmployee.id}`,
      name: newEmployee.name,
      email: newEmployee.email,
      password_hash: await bcrypt.hash(employeePassword, 10),
      role: employeeRole,
      employee_id: newEmployee.id,
      avatar: newEmployee.avatar,
      department: newEmployee.department,
      position: newEmployee.position,
      created_at: new Date().toISOString(),
    });
    return res.status(201).json({ data: sanitizeEmployee(newEmployee) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create employee.' });
  }
});

app.put('/api/employees/:id', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const allowedFields = [
      'name', 'email', 'role', 'id_number', 'department', 'position',
      'basic_salary', 'allowances', 'bank_name', 'bank_account',
      'status', 'join_date', 'avatar',
    ];
    const { fields, values } = buildUpdatePayload(req.body, allowedFields);
    if (!fields.length) {
      return res.status(400).json({ error: 'No valid changes provided.' });
    }

    if (dbReady) {
      const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
      const query = `UPDATE employees SET ${setClause} WHERE id = $${fields.length + 1} RETURNING id, name, email, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at`;
      const result = await dbQuery(query, [...values, req.params.id]);
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Employee not found.' });
      }
      if (req.body.name || req.body.email || req.body.role) {
        await dbQuery(
          `UPDATE users SET
             name = COALESCE($1, name),
             email = COALESCE($2, email),
             role = COALESCE($3, role)
           WHERE employee_id = $4`,
          [req.body.name || null, req.body.email || null, req.body.role || null, req.params.id]
        );
      }
      return res.json({ data: result.rows[0] });
    }

    const index = employees.findIndex((emp) => emp.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    const patch = fields.reduce((acc, field, idx) => ({ ...acc, [field]: values[idx] }), {});
    employees[index] = { ...employees[index], ...patch };
    const user = users.find((u) => u.employee_id === req.params.id);
    if (user) {
      if (patch.name) user.name = patch.name;
      if (patch.email) user.email = patch.email;
      if (patch.role) user.role = patch.role;
      if (patch.avatar) user.avatar = patch.avatar;
      if (patch.department) user.department = patch.department;
      if (patch.position) user.position = patch.position;
    }
    return res.json({ data: sanitizeEmployee(employees[index]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update employee.' });
  }
});

app.post('/api/employees/:id/photo', authenticateToken, requireRoles('Admin', 'HR'), upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required.' });
    }
    const fileUrl = publicFileUrl(req, req.params.id, req.file.filename);
    if (dbReady) {
      const result = await dbQuery(
        `UPDATE employees SET avatar = $1 WHERE id = $2
         RETURNING id, name, email, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at`,
        [fileUrl, req.params.id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Employee not found.' });
      }
      return res.json({ data: result.rows[0] });
    }

    const employee = employees.find((emp) => emp.id === req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    employee.avatar = fileUrl;
    return res.json({ data: sanitizeEmployee(employee) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to upload employee photo.' });
  }
});

app.post('/api/employees/:id/documents', authenticateToken, requireRoles('Admin', 'HR'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required.' });
    }
    const document = {
      id: randomUUID(),
      employee_id: req.params.id,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_url: publicFileUrl(req, req.params.id, req.file.filename),
      mime_type: req.file.mimetype,
      document_type: req.body.documentType || 'document',
      uploaded_by: req.user.id,
      created_at: new Date().toISOString(),
    };

    if (dbReady) {
      const result = await dbQuery(
        `INSERT INTO employee_documents (id, employee_id, filename, original_name, file_url, mime_type, document_type, uploaded_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [document.id, document.employee_id, document.filename, document.original_name, document.file_url, document.mime_type, document.document_type, document.uploaded_by, document.created_at]
      );
      return res.status(201).json({ data: result.rows[0] });
    }

    return res.status(201).json({ data: document });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to upload employee document.' });
  }
});

app.delete('/api/employees/:id', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    if (dbReady) {
      const result = await dbQuery(
        'DELETE FROM employees WHERE id = $1 RETURNING id, name, email, role, id_number, department, position, basic_salary, allowances, bank_name, bank_account, status, join_date, avatar, created_at',
        [req.params.id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Employee not found.' });
      }
      return res.json({ data: result.rows[0] });
    }

    const index = employees.findIndex((emp) => emp.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    const deleted = employees.splice(index, 1)[0];
    return res.json({ data: sanitizeEmployee(deleted) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete employee.' });
  }
});

app.get('/api/payroll', authenticateToken, async (req, res) => {
  try {
    if (dbReady) {
      const result = req.user.role === 'Employee'
        ? await dbQuery('SELECT * FROM payroll_records WHERE employee_id = $1 ORDER BY created_at DESC', [req.user.employeeId])
        : await dbQuery('SELECT * FROM payroll_records ORDER BY created_at DESC');
      return res.json({ data: result.rows });
    }
    const visibleRecords = req.user.role === 'Employee'
      ? payrollRecords.filter((record) => record.employee_id === req.user.employeeId)
      : payrollRecords;
    return res.json({ data: visibleRecords });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch payroll records.' });
  }
});

app.get('/api/payroll/cycle-status', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const month = req.query.month || currentPayrollMonth();
    const cycle = await buildPayrollCycleStatus(month);
    return res.json({ data: cycle });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch payroll cycle status.' });
  }
});

app.post('/api/payroll-records', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    if (dbReady) {
      const records = [];
      for (const record of payload) {
        const id = record.id || `PAY-${record.employee_id}-${Date.now()}`;
        const month = record.month || currentPayrollMonth();
        const existing = await dbQuery(
          'SELECT id FROM payroll_records WHERE employee_id = $1 AND month = $2 LIMIT 1',
          [record.employee_id, month]
        );
        if (existing.rows.length) {
          return res.status(409).json({
            error: `Payroll for ${record.employee_id} in ${month} already exists.`,
          });
        }
        const createdAt = new Date().toISOString();
        const result = await dbQuery(
          `INSERT INTO payroll_records (id, employee_id, month, basic_salary, allowances, overtime, bonus, gross_salary, paye, nssf, nhif, pension, other_deductions, total_deductions, net_salary, status, payment_date, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           RETURNING *`,
            [
            id,
            record.employee_id,
            month,
            record.basic_salary,
            record.allowances,
            record.overtime,
            record.bonus,
            record.gross_salary,
            record.paye,
            record.nssf,
            record.nhif,
            record.pension,
            record.other_deductions,
            record.total_deductions,
            record.net_salary,
            record.status,
            record.payment_date,
            createdAt,
          ]
        );
        records.push(result.rows[0]);
      }
      return res.status(201).json({ data: records });
    }

    const records = [];
    for (const record of payload) {
      const month = record.month || currentPayrollMonth();
      const exists = payrollRecords.some((existing) => existing.employee_id === record.employee_id && existing.month === month);
      if (exists) {
        return res.status(409).json({
          error: `Payroll for ${record.employee_id} in ${month} already exists.`,
        });
      }
      const newRecord = {
        ...record,
        month,
        id: record.id || `PAY-${record.employee_id}-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      payrollRecords.unshift(newRecord);
      records.push(newRecord);
    }
    return res.status(201).json({ data: records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create payroll records.' });
  }
});

app.post('/api/payroll/generate', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const { month = currentPayrollMonth(), bonus = 0, overtime = 0, otherDeductions = 0 } = req.body || {};
    const cycle = await buildPayrollCycleStatus(month);
    if (cycle.totalRecords > 0) {
      return res.status(409).json({
        error: `Payroll for ${month} has already been processed.`,
        data: cycle,
      });
    }
    if (cycle.activeEmployees === 0) {
      return res.status(400).json({ error: 'There are no active employees to process.' });
    }

    const createdRecords = [];

    if (dbReady) {
      const employeeResult = await dbQuery(
        `SELECT id, basic_salary, allowances
         FROM employees
         WHERE status = 'Active'
         ORDER BY name`
      );
      for (const employee of employeeResult.rows) {
        const record = calculatePayrollRecord(employee, { month, bonus, overtime, otherDeductions });
        const result = await dbQuery(
          `INSERT INTO payroll_records (id, employee_id, month, basic_salary, allowances, overtime, bonus, gross_salary, paye, nssf, nhif, pension, other_deductions, total_deductions, net_salary, status, payment_date, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           RETURNING *`,
          [
            record.id, record.employee_id, record.month, record.basic_salary, record.allowances,
            record.overtime, record.bonus, record.gross_salary, record.paye, record.nssf,
            record.nhif, record.pension, record.other_deductions, record.total_deductions,
            record.net_salary, record.status, record.payment_date, record.created_at,
          ]
        );
        createdRecords.push(result.rows[0]);
      }
      return res.status(201).json({ data: createdRecords });
    }

    const activeEmployees = employees.filter((employee) => employee.status === 'Active');
    for (const employee of activeEmployees) {
      const record = calculatePayrollRecord(employee, { month, bonus, overtime, otherDeductions });
      payrollRecords.unshift(record);
      createdRecords.push(record);
    }
    return res.status(201).json({ data: createdRecords });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to generate payroll.' });
  }
});

app.put('/api/payroll-records/:id', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const allowedFields = ['status', 'payment_date'];
    const { fields, values } = buildUpdatePayload(req.body, allowedFields);
    if (!fields.length) {
      return res.status(400).json({ error: 'No valid changes provided.' });
    }

    if (dbReady) {
      const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
      const query = `UPDATE payroll_records SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
      const result = await dbQuery(query, [...values, req.params.id]);
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Payroll record not found.' });
      }
      if (req.body.status === 'Paid') {
        const employeeResult = await dbQuery('SELECT email, name FROM employees WHERE id = $1', [result.rows[0].employee_id]);
        const employee = employeeResult.rows[0];
        await sendNotificationEmail({
          to: employee?.email,
          subject: `Payslip ready for ${result.rows[0].month}`,
          text: `Hello ${employee?.name || 'there'}, your payroll for ${result.rows[0].month} has been processed.`,
        });
      }
      return res.json({ data: result.rows[0] });
    }

    const index = payrollRecords.findIndex((record) => record.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Payroll record not found.' });
    }
    const patch = fields.reduce((acc, field, idx) => ({ ...acc, [field]: values[idx] }), {});
    payrollRecords[index] = { ...payrollRecords[index], ...patch };
    return res.json({ data: payrollRecords[index] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update payroll record.' });
  }
});

app.get('/api/leave-requests', authenticateToken, async (req, res) => {
  try {
    if (dbReady) {
      const result = req.user.role === 'Employee'
        ? await dbQuery('SELECT * FROM leave_requests WHERE employee_id = $1 ORDER BY created_at DESC', [req.user.employeeId])
        : await dbQuery('SELECT * FROM leave_requests ORDER BY created_at DESC');
      return res.json({ data: result.rows });
    }
    const visibleRequests = req.user.role === 'Employee'
      ? leaveRequests.filter((request) => request.employee_id === req.user.employeeId)
      : leaveRequests;
    return res.json({ data: visibleRequests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch leave requests.' });
  }
});

app.post('/api/leave-requests', authenticateToken, async (req, res) => {
  try {
    const payload = req.body;
    const employeeId = req.user.role === 'Employee' ? req.user.employeeId : payload.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee is required.' });
    }
    if (!payload.start_date || !payload.end_date) {
      return res.status(400).json({ error: 'Start date and end date are required.' });
    }
    if (new Date(payload.end_date) < new Date(payload.start_date)) {
      return res.status(400).json({ error: 'Leave end date cannot be before the start date.' });
    }
    if (dbReady) {
      const overlap = await dbQuery(
        `SELECT id FROM leave_requests
         WHERE employee_id = $1
           AND status IN ('Pending', 'Approved')
           AND start_date <= $3
           AND end_date >= $2
         LIMIT 1`,
        [employeeId, payload.start_date, payload.end_date]
      );
      if (overlap.rows.length) {
        return res.status(409).json({ error: 'This leave request overlaps an existing pending or approved leave.' });
      }
      const id = `LV-${employeeId}-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const result = await dbQuery(
        `INSERT INTO leave_requests (id, employee_id, type, start_date, end_date, days, reason, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [id, employeeId, payload.type, payload.start_date, payload.end_date, payload.days, payload.reason, payload.status || 'Pending', createdAt]
      );
      return res.status(201).json({ data: result.rows[0] });
    }

    const newRequest = {
      id: `LV-${employeeId}-${Date.now()}`,
      ...payload,
      employee_id: employeeId,
      status: payload.status || 'Pending',
      created_at: new Date().toISOString(),
    };
    leaveRequests.unshift(newRequest);
    return res.status(201).json({ data: newRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create leave request.' });
  }
});

app.put('/api/leave-requests/:id', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const allowedFields = ['status', 'type', 'start_date', 'end_date', 'days', 'reason'];
    const body = Object.fromEntries(Object.entries(req.body).filter(([field]) => allowedFields.includes(field)));
    if (dbReady) {
      const fields = Object.keys(body);
      const values = Object.values(body);
      if (!fields.length) {
        return res.status(400).json({ error: 'No changes provided.' });
      }
      const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
      const query = `UPDATE leave_requests SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
      const result = await dbQuery(query, [...values, req.params.id]);
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Leave request not found.' });
      }
      return res.json({ data: result.rows[0] });
    }

    const index = leaveRequests.findIndex((lr) => lr.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }
    leaveRequests[index] = { ...leaveRequests[index], ...body };
    return res.json({ data: leaveRequests[index] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update leave request.' });
  }
});

app.get('/api/attendance', authenticateToken, async (req, res) => {
  try {
    if (dbReady) {
      const result = req.user.role === 'Employee'
        ? await dbQuery('SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC', [req.user.employeeId])
        : await dbQuery('SELECT * FROM attendance ORDER BY date DESC');
      return res.json({ data: result.rows });
    }
    const visibleAttendance = req.user.role === 'Employee'
      ? attendance.filter((record) => record.employee_id === req.user.employeeId)
      : attendance;
    return res.json({ data: visibleAttendance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch attendance.' });
  }
});

app.post('/api/attendance', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.employee_id || !payload.date) {
      return res.status(400).json({ error: 'Employee and date are required.' });
    }
    if (dbReady) {
      const existing = await dbQuery('SELECT id FROM attendance WHERE employee_id = $1 AND date = $2 LIMIT 1', [payload.employee_id, payload.date]);
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Attendance for this employee and date already exists.' });
      }
      const id = `AT-${payload.employee_id}-${Date.now()}`;
      const result = await dbQuery(
        `INSERT INTO attendance (id, employee_id, date, check_in, check_out, hours, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, payload.employee_id, payload.date, payload.check_in, payload.check_out, payload.hours, payload.status]
      );
      return res.status(201).json({ data: result.rows[0] });
    }

    const newEntry = {
      id: `AT-${payload.employee_id}-${Date.now()}`,
      ...payload,
    };
    attendance.unshift(newEntry);
    return res.status(201).json({ data: newEntry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create attendance entry.' });
  }
});

app.post('/api/attendance/clock-in', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employeeId || req.body.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee is required.' });
    }
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const checkIn = now.toTimeString().slice(0, 5);
    const status = Number(checkIn.slice(0, 2)) >= 9 ? 'Late' : 'Present';

    if (dbReady) {
      const existing = await dbQuery('SELECT * FROM attendance WHERE employee_id = $1 AND date = $2 LIMIT 1', [employeeId, date]);
      if (existing.rows.length) {
        return res.status(409).json({ error: 'You have already clocked in today.', data: existing.rows[0] });
      }
      const id = `AT-${employeeId}-${Date.now()}`;
      const result = await dbQuery(
        `INSERT INTO attendance (id, employee_id, date, check_in, check_out, hours, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [id, employeeId, date, checkIn, null, 0, status]
      );
      return res.status(201).json({ data: result.rows[0] });
    }

    const existing = attendance.find((record) => record.employee_id === employeeId && record.date === date);
    if (existing) {
      return res.status(409).json({ error: 'You have already clocked in today.', data: existing });
    }
    const entry = {
      id: `AT-${employeeId}-${Date.now()}`,
      employee_id: employeeId,
      date,
      check_in: checkIn,
      check_out: '',
      hours: 0,
      status,
    };
    attendance.unshift(entry);
    return res.status(201).json({ data: entry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to clock in.' });
  }
});

app.post('/api/attendance/clock-out', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employeeId || req.body.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee is required.' });
    }
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const checkOut = now.toTimeString().slice(0, 5);

    const calculateHours = (checkIn, out) => {
      const [inHour, inMin] = String(checkIn).split(':').map(Number);
      const [outHour, outMin] = String(out).split(':').map(Number);
      const minutes = Math.max(0, outHour * 60 + outMin - (inHour * 60 + inMin));
      return Number((minutes / 60).toFixed(2));
    };

    if (dbReady) {
      const existing = await dbQuery('SELECT * FROM attendance WHERE employee_id = $1 AND date = $2 LIMIT 1', [employeeId, date]);
      if (!existing.rows.length) {
        return res.status(404).json({ error: 'Clock-in record not found for today.' });
      }
      if (existing.rows[0].check_out) {
        return res.status(409).json({ error: 'You have already clocked out today.', data: existing.rows[0] });
      }
      const hours = calculateHours(existing.rows[0].check_in, checkOut);
      const result = await dbQuery(
        `UPDATE attendance SET check_out = $1, hours = $2 WHERE id = $3 RETURNING *`,
        [checkOut, hours, existing.rows[0].id]
      );
      return res.json({ data: { ...result.rows[0], overtime_hours: Math.max(0, hours - 8) } });
    }

    const index = attendance.findIndex((record) => record.employee_id === employeeId && record.date === date);
    if (index === -1) {
      return res.status(404).json({ error: 'Clock-in record not found for today.' });
    }
    if (attendance[index].check_out) {
      return res.status(409).json({ error: 'You have already clocked out today.', data: attendance[index] });
    }
    const hours = calculateHours(attendance[index].check_in, checkOut);
    attendance[index] = { ...attendance[index], check_out: checkOut, hours };
    return res.json({ data: { ...attendance[index], overtime_hours: Math.max(0, hours - 8) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to clock out.' });
  }
});

app.get('/api/audit-logs', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    if (dbReady) {
      const result = await dbQuery('SELECT * FROM audit_logs ORDER BY created_at DESC');
      return res.json({ data: result.rows });
    }
    return res.json({ data: auditLogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch audit logs.' });
  }
});

app.post('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const payload = req.body;
    if (dbReady) {
      const result = await dbQuery(
        `INSERT INTO audit_logs (action, user_name, entity_type, entity_id, log_type, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [payload.action, payload.user_name, payload.entity_type || null, payload.entity_id || null, payload.log_type || 'info', new Date().toISOString()]
      );
      return res.status(201).json({ data: result.rows[0] });
    }

    const nextId = auditLogs.length ? Math.max(...auditLogs.map((log) => log.id)) + 1 : 1;
    const entry = {
      id: nextId,
      action: payload.action,
      user_name: payload.user_name,
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      log_type: payload.log_type || 'info',
      created_at: new Date().toISOString(),
    };
    auditLogs.unshift(entry);
    return res.status(201).json({ data: entry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create audit log.' });
  }
});

app.post('/api/payslips', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const { employeeId, period, grossPay, netPay } = req.body;
    if (!employeeId || !period || grossPay == null || netPay == null) {
      return res.status(400).json({ error: 'Missing payslip fields.' });
    }

    if (dbReady) {
      const id = `${Date.now()}`;
      const result = await dbQuery(
        `INSERT INTO payslips (id, employee_id, period, gross_pay, net_pay, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, employeeId, period, grossPay, netPay, new Date().toISOString()]
      );
      return res.status(201).json({ data: result.rows[0], message: 'Payslip created successfully.' });
    }

    const payslip = {
      id: `${Date.now()}`,
      employee_id: employeeId,
      period,
      gross_pay: grossPay,
      net_pay: netPay,
      created_at: new Date().toISOString(),
    };
    return res.status(201).json({ data: payslip, message: 'Payslip created successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create payslip.' });
  }
});

app.get('/api/payslips/:payrollId/download', authenticateToken, async (req, res) => {
  try {
    let payroll;
    let employee;
    if (dbReady) {
      const payrollResult = await dbQuery('SELECT * FROM payroll_records WHERE id = $1', [req.params.payrollId]);
      if (!payrollResult.rows.length) {
        return res.status(404).json({ error: 'Payroll record not found.' });
      }
      payroll = payrollResult.rows[0];
      if (!canAccessEmployee(req, payroll.employee_id)) {
        return res.status(403).json({ error: 'You do not have permission to download this payslip.' });
      }
      const employeeResult = await dbQuery('SELECT * FROM employees WHERE id = $1', [payroll.employee_id]);
      employee = employeeResult.rows[0];
    } else {
      payroll = payrollRecords.find((record) => record.id === req.params.payrollId);
      if (!payroll) {
        return res.status(404).json({ error: 'Payroll record not found.' });
      }
      if (!canAccessEmployee(req, payroll.employee_id)) {
        return res.status(403).json({ error: 'You do not have permission to download this payslip.' });
      }
      employee = employees.find((emp) => emp.id === payroll.employee_id);
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    pipePayslipPdf(res, payroll, employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to download payslip.' });
  }
});

app.get('/api/reports/summary', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const sourceEmployees = dbReady
      ? (await dbQuery('SELECT * FROM employees')).rows
      : employees;
    const sourcePayroll = dbReady
      ? (await dbQuery('SELECT * FROM payroll_records')).rows
      : payrollRecords;
    const sourceAttendance = dbReady
      ? (await dbQuery('SELECT * FROM attendance')).rows
      : attendance;
    const sourceLeave = dbReady
      ? (await dbQuery('SELECT * FROM leave_requests')).rows
      : leaveRequests;

    const departments = sourceEmployees.reduce((acc, employee) => {
      const department = employee.department || 'Unassigned';
      if (!acc[department]) acc[department] = { count: 0, salary: 0 };
      acc[department].count += 1;
      acc[department].salary += Number(employee.basic_salary || 0);
      return acc;
    }, {});

    const summary = {
      totalEmployees: sourceEmployees.length,
      activeEmployees: sourceEmployees.filter((employee) => employee.status === 'Active').length,
      payrollExpense: sourcePayroll.reduce((sum, record) => sum + Number(record.net_salary || 0), 0),
      grossPayroll: sourcePayroll.reduce((sum, record) => sum + Number(record.gross_salary || 0), 0),
      totalDeductions: sourcePayroll.reduce((sum, record) => sum + Number(record.total_deductions || 0), 0),
      attendance: {
        present: sourceAttendance.filter((record) => record.status === 'Present').length,
        late: sourceAttendance.filter((record) => record.status === 'Late').length,
        absent: sourceAttendance.filter((record) => record.status === 'Absent').length,
      },
      leave: {
        pending: sourceLeave.filter((request) => request.status === 'Pending').length,
        approved: sourceLeave.filter((request) => request.status === 'Approved').length,
        rejected: sourceLeave.filter((request) => request.status === 'Rejected').length,
      },
      departments,
    };
    return res.json({ data: summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch reports summary.' });
  }
});

app.get('/api/reports/export/:reportId', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const reportId = req.params.reportId;
    const format = String(req.query.format || 'csv').toLowerCase();
    const period = ['month', 'quarter', 'year', 'all'].includes(req.query.period) ? req.query.period : 'month';
    const month = req.query.month || currentPayrollMonth();
    const scopeLabel = period === 'all' ? 'All Time' : `${period} ${month}`;
    const report = await buildReportExport({ reportId, period, month });
    const hasMeaningfulRows = report.rows.length > 0 && report.rows.some((row) =>
      row.some((cell) => typeof cell === 'string' ? cell.trim() !== '' : Number(cell) !== 0)
    );

    if (!hasMeaningfulRows) {
      return res.status(404).json({
        error: `No ${report.title.toLowerCase()} data found for ${scopeLabel}.`,
      });
    }

    const filename = reportFileName(report.title, month);
    if (format === 'pdf') {
      return sendReportPdf(res, report, scopeLabel, filename);
    }
    if (format === 'excel' || format === 'xls') {
      return sendReportExcel(res, report, scopeLabel, filename);
    }
    return sendReportCsv(res, report, filename);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to export report.' });
  }
});

app.get('/api/settings', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const settings = await getAppSettings();
    res.json({
      data: settings,
      meta: {
        databaseConnected: dbReady,
        emailConfigured: Boolean(getTransporter()),
        environment: process.env.NODE_ENV || 'development',
        requireDatabase,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch settings.' });
  }
});

app.put('/api/settings', authenticateToken, requireRoles('Admin'), async (req, res) => {
  try {
    const updates = req.body || {};
    if (updates.payroll) {
      const numericFields = ['nssfRate', 'shifRate', 'pensionRate', 'personalRelief', 'overtimeRate', 'nssfCap', 'workDayHours'];
      for (const field of numericFields) {
        if (updates.payroll[field] != null && Number(updates.payroll[field]) < 0) {
          return res.status(400).json({ error: `${field} cannot be negative.` });
        }
      }
    }
    const settings = await saveAppSettings(updates);
    res.json({ data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to save settings.' });
  }
});

app.post('/api/settings/test-email', authenticateToken, requireRoles('Admin'), async (req, res) => {
  try {
    const to = req.body?.to || req.user.email;
    const result = await sendNotificationEmail({
      to,
      subject: 'PayrollPro email test',
      text: 'Your PayrollPro email notification settings are working.',
    });
    if (result.skipped) {
      return res.status(400).json({ error: result.reason });
    }
    res.json({ data: result, message: `Test email sent to ${to}.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to send test email.' });
  }
});

app.post('/api/notifications/salary-processed', authenticateToken, requireRoles('Admin', 'HR'), async (req, res) => {
  try {
    const { employeeId, payrollId } = req.body;
    const employee = dbReady
      ? (await dbQuery('SELECT * FROM employees WHERE id = $1', [employeeId])).rows[0]
      : employees.find((emp) => emp.id === employeeId);
    const payroll = dbReady
      ? (await dbQuery('SELECT * FROM payroll_records WHERE id = $1', [payrollId])).rows[0]
      : payrollRecords.find((record) => record.id === payrollId);

    if (!employee || !payroll) {
      return res.status(404).json({ error: 'Employee or payroll record not found.' });
    }

    const result = await sendNotificationEmail({
      to: employee.email,
      subject: `Salary processed for ${payroll.month}`,
      text: `Hello ${employee.name}, your salary for ${payroll.month} has been processed. Net pay: KES ${Number(payroll.net_salary).toLocaleString()}.`,
    });
    return res.json({ data: result, message: result.skipped ? result.reason : 'Notification sent.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to send notification.' });
  }
});

const startServer = async () => {
  await initDatabase();
  const server = app.listen(port);

  server.on('listening', () => {
    console.log(`Backend server listening on http://localhost:${port}`);
    if (!dbReady) {
      console.log('PostgreSQL not available; running in fallback in-memory mode.');
    }
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the process using it or set PORT to another value in .env.`);
      process.exit(1);
    }
    console.error('Failed to start backend:', error);
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});
