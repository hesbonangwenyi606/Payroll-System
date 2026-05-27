import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const Login: React.FC = () => {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as any)?.from?.pathname || '/';

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await login(email.trim(), password.trim());
      toast({ title: 'Signed in successfully', description: 'Welcome back!' });
      navigate(from, { replace: true });
    } catch (error) {
      toast({ title: 'Login failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Login</h1>
        <p className="text-sm text-slate-500 mb-6">Sign in to access your payroll dashboard or employee portal.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-500">
          Use one of the sample accounts:
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>admin@example.com / password123</li>
            <li>hr@example.com / password123</li>
            <li>employee@example.com / password123</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;
