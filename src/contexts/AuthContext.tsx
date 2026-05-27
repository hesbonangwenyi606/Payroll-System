import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'Admin' | 'HR' | 'Employee';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
  position?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || '';
const ALLOW_DEMO_AUTH = import.meta.env.VITE_ALLOW_DEMO_AUTH === 'true';

const parseResponse = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// Local fallback accounts used when backend is not reachable (deployed static frontend)
const FALLBACK_USERS: Record<string, AuthUser & { password: string }> = {
  'admin@example.com': { id: 'USR-EMP0001', employeeId: 'EMP0001', name: 'Admin User', email: 'admin@example.com', avatar: 'https://i.pravatar.cc/150?img=12', role: 'Admin', password: 'password123' },
  'hr@example.com': { id: 'USR-EMP0002', employeeId: 'EMP0002', name: 'HR Manager', email: 'hr@example.com', avatar: 'https://i.pravatar.cc/150?img=23', role: 'HR', password: 'password123' },
  'employee@example.com': { id: 'USR-EMP0003', employeeId: 'EMP0003', name: 'Employee User', email: 'employee@example.com', avatar: 'https://i.pravatar.cc/150?img=45', role: 'Employee', password: 'password123' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('authUser');
    const savedToken = localStorage.getItem('authToken');
    if (!saved) return null;
    if (!savedToken && !ALLOW_DEMO_AUTH) return null;
    return JSON.parse(saved);
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));

  useEffect(() => {
    if (user) {
      localStorage.setItem('authUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('authUser');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const url = `${API_BASE}/api/auth/login`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const parsed = await parseResponse(res);
      if (!res.ok) {
        const bodyStr = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
        const msg = `Request to ${url} returned ${res.status} ${res.statusText}: ${bodyStr}`;
        if (ALLOW_DEMO_AUTH && res.status === 404) {
          const fallback = FALLBACK_USERS[email.toLowerCase()];
          if (fallback && fallback.password === password) {
            const { password: _p, ...userWithoutPassword } = fallback;
            setUser(userWithoutPassword);
            setToken(null);
            return;
          }
          throw new Error(msg);
        }
        throw new Error(msg);
      }

      if (!parsed || !parsed.data) {
        throw new Error(`Request to ${url} returned invalid response`);
      }

      setUser(parsed.data);
      setToken(parsed.token || null);
    } catch (error: any) {
      const fallback = ALLOW_DEMO_AUTH ? FALLBACK_USERS[email.toLowerCase()] : null;
      if (fallback && fallback.password === password) {
        const { password: _p, ...userWithoutPassword } = fallback;
        setUser(userWithoutPassword);
        setToken(null);
        return;
      }
      const errMsg = error?.message || String(error);
      throw new Error(`Login request failed: ${errMsg}`);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const updateProfile = (updates: Partial<AuthUser>) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      return { ...currentUser, ...updates };
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: Boolean(user), login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
