import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Logo } from '../../components/common/Logo';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
  CheckCircle2,
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid administrator email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    loginAdmin,
    isAuthenticated,
    user,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const locationState = location.state as { from?: { pathname: string }; error?: string } | null;
  const rawFrom = locationState?.from?.pathname;
  const from = rawFrom && rawFrom !== '/login' && rawFrom !== '/setup' ? rawFrom : '/dashboard';
  const redirectedError = locationState?.error || null;
  const displayedError = error || redirectedError;

  // Redirect already-authenticated users straight to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, from, navigate]);

  const adminLoginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@stockvista.in',
      password: '',
      rememberMe: true,
    },
  });

  // Auto-remember & prefill saved password on every login
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stockvista_remembered_admin');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) {
          adminLoginForm.setValue('email', parsed.email);
        }
        if (parsed.password) {
          adminLoginForm.setValue('password', parsed.password);
        }
        adminLoginForm.setValue('rememberMe', true);
      } else {
        adminLoginForm.setValue('email', 'admin@stockvista.in');
        adminLoginForm.setValue('password', 'StockVista@2026');
      }
    } catch {}
  }, [adminLoginForm]);

  const onAdminLoginSubmit = async (data: LoginFormData) => {
    clearError();
    try {
      await loginAdmin(data.email, data.password, data.rememberMe);

      // Save or remove remembered credentials based on rememberMe checkbox
      if (data.rememberMe) {
        localStorage.setItem(
          'stockvista_remembered_admin',
          JSON.stringify({ email: data.email, password: data.password })
        );
      } else {
        localStorage.removeItem('stockvista_remembered_admin');
      }

      navigate(from, { replace: true });
    } catch {
      // Handled in authStore
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] flex flex-col lg:flex-row relative overflow-hidden transition-colors selection:bg-brand-orange selection:text-white">
      {/* Ambient gradient backgrounds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Left Column: Brand Hero */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-white dark:bg-[#0B0D14] border-r border-slate-200/80 dark:border-white/[0.06] relative z-10 transition-colors">
        <div>
          <Logo size="lg" showWordmark={true} />
        </div>

        <div className="space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-semibold">
            <Database className="w-3.5 h-3.5" />
            <span>SQLite Server Engine • Production Ready</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 dark:text-[#F2F4F8] tracking-tight leading-tight">
            Enterprise Warehouse & Inventory Control.
          </h1>

          <p className="text-sm text-slate-600 dark:text-[#9AA0AE] leading-relaxed">
            Real-time multi-hub stock management, verified SQLite storage, and direct stock adjustment calibrated for Indian wholesale enterprises.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>Real-Time Stock Management</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>Multi-Warehouse Operations</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>Native SQLite Backend</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>Direct Stock Adjustment</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-200 dark:border-white/10 pt-6">
          <span>Enterprise Release 2.1 • FY 2026-27</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            SQLite WAL Engine Active
          </span>
        </div>
      </div>

      {/* Right Column: Form Area */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden mb-4">
            <Logo size="md" showWordmark={true} />
          </div>

          <div className="space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-bold mb-2 uppercase tracking-wider">
                👑 Administrator Portal
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-[#F2F4F8] tracking-tight">
                Admin Sign-In
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9AA0AE] mt-1">
                Enter your master administrator credentials to access the workspace.
              </p>
            </div>

            <form onSubmit={adminLoginForm.handleSubmit(onAdminLoginSubmit)} className="space-y-4">
              <Input
                label="Admin Login ID / Email *"
                type="email"
                placeholder="admin@stockvista.in"
                leftIcon={<Mail className="w-4 h-4" strokeWidth={1.5} />}
                error={adminLoginForm.formState.errors.email?.message}
                {...adminLoginForm.register('email')}
              />

              <Input
                label="Admin Password *"
                type={showAdminPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" strokeWidth={1.5} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((prev) => !prev)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition focus:outline-none cursor-pointer"
                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                    title={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? (
                      <EyeOff className="w-4 h-4 text-brand-orange" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
                error={adminLoginForm.formState.errors.password?.message}
                {...adminLoginForm.register('password')}
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-600 dark:text-[#9AA0AE] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-orange focus:ring-brand-orange accent-[#FF6B35]"
                    {...adminLoginForm.register('rememberMe')}
                  />
                  <span>Remember password on this terminal</span>
                </label>
              </div>

              {displayedError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{displayedError}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full"
              >
                Sign In as Administrator
              </Button>
            </form>

            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Default Admin Login ID:</span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">admin@stockvista.in</strong>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Default Password:</span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">StockVista@2026</strong>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/[0.06] text-center text-xs text-slate-500 dark:text-[#9AA0AE] space-y-2">
              <p>
                First time deploying or want to configure a new administrator?{' '}
                <Link to="/setup" className="text-brand-orange font-bold hover:underline">
                  First-Time Setup & Password Generator
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
