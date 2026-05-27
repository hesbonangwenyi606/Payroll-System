import React, { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  Database,
  Mail,
  Save,
  ShieldCheck,
  UploadCloud,
  Wrench,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePayroll } from '@/contexts/PayrollContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

type SettingsPayload = {
  company: {
    name: string;
    taxPin: string;
    address: string;
    email: string;
    phone: string;
    currency: string;
    payCycle: string;
  };
  payroll: {
    nssfRate: number;
    shifRate: number;
    pensionRate: number;
    personalRelief: number;
    overtimeRate: number;
    nssfCap: number;
    workDayHours: number;
    payrollApprovalRequired: boolean;
  };
  notifications: Record<string, boolean>;
  integrations: Record<string, boolean>;
};

const defaultSettings: SettingsPayload = {
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

const notificationLabels: Record<string, string> = {
  autoEmailPayslips: 'Email payslips to employees automatically',
  salaryPaymentAlerts: 'Send salary payment notifications',
  payrollApprovalAlerts: 'Notify on payroll approval required',
  taxDeadlineReminders: 'Tax filing deadline reminders',
  dailyAttendanceSummary: 'Daily attendance summary',
  leaveRequestAlerts: 'Leave request alerts',
};

export const Settings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { setCurrentUser } = usePayroll();
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [settings, setSettings] = useState<SettingsPayload>(defaultSettings);
  const [meta, setMeta] = useState({
    databaseConnected: false,
    emailConfigured: false,
    environment: 'development',
    requireDatabase: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    setAvatarPreview(user?.avatar || '');
  }, [user?.avatar]);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/api/settings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || 'Unable to load settings');
        setSettings({
          ...defaultSettings,
          ...body.data,
          company: { ...defaultSettings.company, ...(body.data?.company || {}) },
          payroll: { ...defaultSettings.payroll, ...(body.data?.payroll || {}) },
          notifications: { ...defaultSettings.notifications, ...(body.data?.notifications || {}) },
          integrations: { ...defaultSettings.integrations, ...(body.data?.integrations || {}) },
        });
        setMeta(body.meta || meta);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async (patch: Partial<SettingsPayload>) => {
    if (!isAdmin) {
      toast.error('Only Admin users can change system settings');
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(patch),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'Unable to save settings');
      setSettings({
        ...defaultSettings,
        ...body.data,
        company: { ...defaultSettings.company, ...(body.data?.company || {}) },
        payroll: { ...defaultSettings.payroll, ...(body.data?.payroll || {}) },
        notifications: { ...defaultSettings.notifications, ...(body.data?.notifications || {}) },
        integrations: { ...defaultSettings.integrations, ...(body.data?.integrations || {}) },
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Profile photo must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarDataUrl = reader.result as string;
      setAvatarPreview(avatarDataUrl);
      updateProfile({ avatar: avatarDataUrl });
      setCurrentUser((current: any) => ({ ...current, avatar: avatarDataUrl }));
      toast.success('Profile picture updated on this device');
    };
    reader.readAsDataURL(file);
  };

  const updateCompany = (field: keyof SettingsPayload['company'], value: string) => {
    setSettings(current => ({ ...current, company: { ...current.company, [field]: value } }));
  };

  const updatePayroll = (field: keyof SettingsPayload['payroll'], value: number | boolean) => {
    setSettings(current => ({ ...current, payroll: { ...current.payroll, [field]: value } }));
  };

  const updateNotification = (field: string, value: boolean) => {
    const notifications = { ...settings.notifications, [field]: value };
    setSettings(current => ({ ...current, notifications }));
    saveSettings({ notifications });
  };

  const updateIntegration = (field: string, value: boolean) => {
    const integrations = { ...settings.integrations, [field]: value };
    setSettings(current => ({ ...current, integrations }));
    saveSettings({ integrations });
  };

  const testEmail = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/settings/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ to: settings.company.email || user?.email }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'Unable to send test email');
      toast.success(body?.message || 'Test email sent');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send test email');
    }
  };

  const integrationRows = [
    { key: 'bankGateway', name: 'Bank Payment Gateway', desc: 'Salary transfer provider connection' },
    { key: 'accountingSoftware', name: 'Accounting Software', desc: 'Finance ledger export readiness' },
    { key: 'biometricAttendance', name: 'Biometric Attendance', desc: 'External time clock device connection' },
    { key: 'kraItax', name: 'KRA iTax', desc: 'PAYE returns preparation status' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
              {avatarPreview ? (
                <img src={avatarPreview} alt={user?.name || 'Profile'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No photo</div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{user?.name}</h3>
              <p className="text-sm text-slate-500">{user?.role} • {user?.email}</p>
              <label className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition text-sm font-semibold">
                <UploadCloud className="w-4 h-4" />
                Select image
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Database', ok: meta.databaseConnected },
              { label: 'Email', ok: meta.emailConfigured },
              { label: 'Mode', value: meta.environment },
              { label: 'DB Required', ok: meta.requireDatabase },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`text-sm font-bold flex items-center gap-1 ${item.ok === false ? 'text-red-700' : 'text-green-700'}`}>
                  {item.value || (item.ok ? <><CheckCircle2 className="w-4 h-4" /> OK</> : <><XCircle className="w-4 h-4" /> Off</>)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          Settings are read-only for your role. Ask an Admin to change company, payroll, notification, or integration settings.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <form onSubmit={(event) => { event.preventDefault(); saveSettings({ company: settings.company }); }} className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold">Company Information</h3>
          </div>
          <div className="space-y-3">
            {[
              ['name', 'Company Name'],
              ['taxPin', 'Tax PIN'],
              ['address', 'Address'],
              ['email', 'Company Email'],
              ['phone', 'Phone'],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs font-medium text-slate-700 block mb-1">{label}</label>
                <input
                  disabled={!isAdmin || loading}
                  value={settings.company[field as keyof SettingsPayload['company']]}
                  onChange={event => updateCompany(field as keyof SettingsPayload['company'], event.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Currency</label>
                <select disabled={!isAdmin || loading} value={settings.company.currency} onChange={event => updateCompany('currency', event.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-50">
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Pay Cycle</label>
                <select disabled={!isAdmin || loading} value={settings.company.payCycle} onChange={event => updateCompany('payCycle', event.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-50">
                  <option>Monthly</option>
                  <option>Bi-Weekly</option>
                  <option>Weekly</option>
                </select>
              </div>
            </div>
            <button disabled={!isAdmin || saving} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Company
            </button>
          </div>
        </form>

        <form onSubmit={(event) => { event.preventDefault(); saveSettings({ payroll: settings.payroll }); }} className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold">Payroll Rules</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['nssfRate', 'NSSF Rate (%)', 0.01],
              ['shifRate', 'SHIF Rate (%)', 0.01],
              ['pensionRate', 'Pension Rate (%)', 0.01],
              ['personalRelief', 'Personal Relief (KES)', 1],
              ['overtimeRate', 'Overtime Multiplier', 0.1],
              ['nssfCap', 'NSSF Cap (KES)', 1],
              ['workDayHours', 'Workday Hours', 0.25],
            ].map(([field, label, step]) => (
              <div key={field}>
                <label className="text-xs font-medium text-slate-700 block mb-1">{label}</label>
                <input
                  disabled={!isAdmin || loading}
                  type="number"
                  min="0"
                  step={step as number}
                  value={settings.payroll[field as keyof SettingsPayload['payroll']] as number}
                  onChange={event => updatePayroll(field as keyof SettingsPayload['payroll'], Number(event.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>
            ))}
            <label className="col-span-2 flex items-center justify-between rounded-xl bg-slate-50 p-3 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">Require approval before payroll is paid</span>
              <input
                disabled={!isAdmin}
                type="checkbox"
                checked={settings.payroll.payrollApprovalRequired}
                onChange={event => updatePayroll('payrollApprovalRequired', event.target.checked)}
                className="w-9 h-5 appearance-none bg-slate-200 rounded-full relative cursor-pointer checked:bg-blue-600 transition before:absolute before:left-0.5 before:top-0.5 before:w-4 before:h-4 before:bg-white before:rounded-full before:transition checked:before:translate-x-4 disabled:opacity-50"
              />
            </label>
          </div>
          <button disabled={!isAdmin || saving} type="submit" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Payroll Rules
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold">Notification Preferences</h3>
            </div>
            <button disabled={!isAdmin} onClick={testEmail} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> Test Email
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(notificationLabels).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-slate-700">{label}</span>
                <input
                  disabled={!isAdmin || saving}
                  type="checkbox"
                  checked={Boolean(settings.notifications[key])}
                  onChange={event => updateNotification(key, event.target.checked)}
                  className="w-9 h-5 appearance-none bg-slate-200 rounded-full relative cursor-pointer checked:bg-blue-600 transition before:absolute before:left-0.5 before:top-0.5 before:w-4 before:h-4 before:bg-white before:rounded-full before:transition checked:before:translate-x-4 disabled:opacity-50"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-green-600" />
            <h3 className="font-bold">Integrations & System Status</h3>
          </div>
          <div className="space-y-3">
            {integrationRows.map(row => (
              <div key={row.key} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.desc}</p>
                </div>
                <label className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${settings.integrations[row.key] ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                    {settings.integrations[row.key] ? 'Enabled' : 'Off'}
                  </span>
                  <input
                    disabled={!isAdmin || saving}
                    type="checkbox"
                    checked={Boolean(settings.integrations[row.key])}
                    onChange={event => updateIntegration(row.key, event.target.checked)}
                    className="w-9 h-5 appearance-none bg-slate-200 rounded-full relative cursor-pointer checked:bg-blue-600 transition before:absolute before:left-0.5 before:top-0.5 before:w-4 before:h-4 before:bg-white before:rounded-full before:transition checked:before:translate-x-4 disabled:opacity-50"
                  />
                </label>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">SMTP Email Service</p>
                <p className="text-xs text-slate-500">Configured with EMAIL_HOST, EMAIL_USER, and EMAIL_PASS</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${meta.emailConfigured ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {meta.emailConfigured ? 'Configured' : 'Missing'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
