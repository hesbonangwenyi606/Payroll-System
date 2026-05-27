import React, { useState } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Bell, Menu } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { currentView, setCurrentView, currentUser } = usePayroll();
  const { logout } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [showMobile, setShowMobile] = useState(false);

  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    employees: 'Employee Management',
    payroll: 'Payroll Processing',
    payslips: 'Payslips',
    reports: 'Reports & Analytics',
    attendance: 'Attendance & Leave',
    security: 'Users & Security',
    settings: 'Settings',
  };

  const notifications = [
    { title: 'Payroll approval needed', desc: '40 employees pending approval', time: '2m ago', color: 'bg-orange-500' },
    { title: 'New employee added', desc: 'Sarah Wanjiru joined Engineering', time: '1h ago', color: 'bg-blue-500' },
    { title: 'Payslips sent', desc: 'Monthly payslips emailed to 47 employees', time: '3h ago', color: 'bg-green-500' },
    { title: 'Tax filing reminder', desc: 'PAYE submission due in 5 days', time: '1d ago', color: 'bg-red-500' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => setShowMobile(!showMobile)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{titles[currentView]}</h2>
            <p className="text-xs text-slate-500 hidden sm:block">Welcome back, {currentUser.name.split(' ')[0]}</p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees, payslips, reports..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Logout
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="relative p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            {showNotif && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900">Notifications</h3>
                    <span className="text-xs text-blue-600 font-medium">4 new</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((n, i) => (
                      <div key={i} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50">
                        <div className="flex gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${n.color}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{n.title}</p>
                            <p className="text-xs text-slate-500">{n.desc}</p>
                            <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <img src={currentUser.avatar} alt={currentUser.name} className="w-9 h-9 rounded-full border-2 border-slate-200" />
        </div>
      </div>

      {showMobile && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(titles).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setCurrentView(key); setShowMobile(false); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium text-left ${
                  currentView === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
