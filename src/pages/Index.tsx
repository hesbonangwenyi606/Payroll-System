
import React from 'react';
import { Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { AppProvider } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

const Index: React.FC = () => {
  const { user } = useAuth();

  if (user?.role === 'Employee') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
};

export default Index;
