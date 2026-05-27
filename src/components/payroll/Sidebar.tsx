import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePayroll } from '@/contexts/PayrollContext';
import { LayoutDashboard, Users, Calculator, FileText, BarChart3, Calendar, Settings, Shield, Building2, LogOut } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'payroll', label: 'Payroll Processing', icon: Calculator },
  { id: 'payslips', label: 'Payslips', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'attendance', label: 'Attendance & Leave', icon: Calendar },
  { id: 'security', label: 'Users & Security', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, currentUser } = usePayroll();
  const { logout } = useAuth();

  return (
    <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-100 flex-col h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">PayrollPro</h1>
          <p className="text-xs text-slate-400">Enterprise Suite</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="px-3 text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">Main</p>
        {navItems.map(item => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{currentUser.name}</p>
            <p className="text-xs text-slate-400">{currentUser.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
};
