import React, { useState } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { Shield, UserPlus, Lock, Activity, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const Security: React.FC = () => {
  const { auditLogs, logAudit } = usePayroll();
  const [showPwd, setShowPwd] = useState(false);

  const users = [
    { name: 'Alex Morgan', email: 'alex@company.co.ke', role: 'Admin', status: 'Active', last: '2 min ago', avatar: 'https://i.pravatar.cc/150?img=12' },
    { name: 'Sarah Wanjiru', email: 'sarah@company.co.ke', role: 'HR Manager', status: 'Active', last: '15 min ago', avatar: 'https://i.pravatar.cc/150?img=23' },
    { name: 'John Kamau', email: 'john@company.co.ke', role: 'HR Manager', status: 'Active', last: '1 hr ago', avatar: 'https://i.pravatar.cc/150?img=33' },
    { name: 'Mary Otieno', email: 'mary@company.co.ke', role: 'Employee', status: 'Active', last: '3 hr ago', avatar: 'https://i.pravatar.cc/150?img=45' },
    { name: 'David Mwangi', email: 'david@company.co.ke', role: 'Finance', status: 'Inactive', last: '2 days ago', avatar: 'https://i.pravatar.cc/150?img=52' },
  ];

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await logAudit('Password changed', 'success');
    toast.success('Password updated');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold">System Users</h3>
              <p className="text-xs text-slate-500">{users.length} users with system access</p>
            </div>
            <button onClick={async () => { await logAudit('User invitation sent', 'info'); toast.success('Invitation sent'); }} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Invite
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {users.map((u, i) => (
              <div key={i} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50">
                <img src={u.avatar} className="w-10 h-10 rounded-full" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.role === 'Admin' ? 'bg-red-100 text-red-700' :
                    u.role === 'HR Manager' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{u.role}</span>
                  <p className="text-xs text-slate-400 mt-1">{u.last}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${u.status === 'Active' ? 'bg-green-500' : 'bg-slate-300'}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold">Change Password</h3>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Current Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg outline-none focus:border-blue-500" defaultValue="••••••••" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">New Password</label>
              <input type="password" className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Confirm Password</label>
              <input type="password" className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
              Update Password
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-green-600" />
              <h3 className="font-bold">Security Settings</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Two-Factor Authentication', enabled: true },
                { label: 'Login Notifications', enabled: true },
                { label: 'Session Timeout (30 min)', enabled: false },
              ].map((s, i) => (
                <label key={i} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700">{s.label}</span>
                  <input type="checkbox" defaultChecked={s.enabled} className="w-9 h-5 appearance-none bg-slate-200 rounded-full relative cursor-pointer checked:bg-blue-600 transition before:absolute before:left-0.5 before:top-0.5 before:w-4 before:h-4 before:bg-white before:rounded-full before:transition checked:before:translate-x-4" />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-slate-600" />
          <div className="flex-1">
            <h3 className="font-bold">Audit Log</h3>
            <p className="text-xs text-slate-500">Recent system activity from database ({auditLogs.length} entries)</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {auditLogs.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">No audit log entries yet</div>
          )}
          {auditLogs.map(a => (
            <div key={a.id} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                a.logType === 'success' ? 'bg-green-500' :
                a.logType === 'warning' ? 'bg-orange-500' :
                a.logType === 'error' ? 'bg-red-500' :
                'bg-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{a.action}</p>
                <p className="text-xs text-slate-500">by {a.userName}</p>
              </div>
              <p className="text-xs text-slate-400 flex-shrink-0">{formatTime(a.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
