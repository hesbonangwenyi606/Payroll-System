import React from 'react';
import { PayrollProvider, usePayroll } from '@/contexts/PayrollContext';
import { Sidebar } from '@/components/payroll/Sidebar';
import { TopBar } from '@/components/payroll/TopBar';
import { Dashboard } from '@/components/payroll/Dashboard';
import { Employees } from '@/components/payroll/Employees';
import { PayrollProcessing } from '@/components/payroll/PayrollProcessing';
import { Payslips } from '@/components/payroll/Payslips';
import { Reports } from '@/components/payroll/Reports';
import { Attendance } from '@/components/payroll/Attendance';
import { Security } from '@/components/payroll/Security';
import { Settings } from '@/components/payroll/Settings';

const ViewRouter: React.FC = () => {
  const { currentView } = usePayroll();
  switch (currentView) {
    case 'dashboard': return <Dashboard />;
    case 'employees': return <Employees />;
    case 'payroll': return <PayrollProcessing />;
    case 'payslips': return <Payslips />;
    case 'reports': return <Reports />;
    case 'attendance': return <Attendance />;
    case 'security': return <Security />;
    case 'settings': return <Settings />;
    default: return <Dashboard />;
  }
};

const PayrollApp: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1">
          <ViewRouter />
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <PayrollProvider>
      <PayrollApp />
    </PayrollProvider>
  );
};

export default AppLayout;
