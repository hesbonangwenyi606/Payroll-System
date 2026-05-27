
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import EmployeePortal from "./pages/EmployeePortal";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PayrollProvider } from "@/contexts/PayrollContext";
import FallbackBanner from '@/components/ui/FallbackBanner';

const queryClient = new QueryClient();

const RequireAuth: React.FC<{ children: React.ReactNode; allowedRoles?: Array<string> }> = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthAwareBanner />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/portal" element={<RequireAuth allowedRoles={["Employee"]}><PayrollProvider><EmployeePortal /></PayrollProvider></RequireAuth>} />
              <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

const AuthAwareBanner: React.FC = () => {
  try {
    const { user, token } = useAuth();
    if (!user) return null;
    if (!token) {
      return <FallbackBanner />;
    }
    return null;
  } catch {
    return null;
  }
};
