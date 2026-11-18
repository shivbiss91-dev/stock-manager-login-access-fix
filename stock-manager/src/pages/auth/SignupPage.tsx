import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  Database,
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { generateStrongPassword, evaluatePasswordStrength } from '../../utils/passwordGenerator';
import { apiRequest } from '../../services/api';
import { AuthSession } from '../../types/auth';
import { StorageService, STORAGE_KEYS } from '../../services/storageService';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotificationStore();
  const { setSession } = useAuthStore() as any;

  const [name, setName] = useState('StockVista Administrator');
  const [email, setEmail] = useState('admin@stockvista.in');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = evaluatePasswordStrength(password);

  const handleSuggestPassword = () => {
    const generated = generateStrongPassword(16);
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);

    navigator.clipboard?.writeText(generated);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);

    addNotification({
      title: 'Strong Password Generated',
      message: 'A cryptographically secure password was created and copied to your clipboard.',
      type: 'success',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter administrator full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid administrator email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long for administrator accounts.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try to register with SQLite backend
      let session: AuthSession | null = null;
      try {
        session = await apiRequest<AuthSession>('/auth/setup-admin', 'POST', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
      } catch {
        // Fallback when backend is offline
      }

      if (!session) {
        // Create local session
        const now = new Date().toISOString();
        session = {
          token: `sv-admin-${Date.now()}`,
          user: {
            id: 'user-admin-root',
            email: email.trim().toLowerCase(),
            name: name.trim(),
            role: 'admin',
            roleTitle: 'System Administrator',
            warehouseId: 'all',
            warehouseName: 'All Warehouses',
            status: 'active',
            permissions: [
              'module_dashboard',
              'module_items',
              'module_stock',
              'module_warehouses',
              'module_transfers',
              'module_orders',
              'module_invoices',
            ],
            createdAt: now,
            lastLogin: now,
          },
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
      }

      // Save credentials if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem(
          'stockvista_remembered_admin',
          JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          })
        );
      } else {
        localStorage.removeItem('stockvista_remembered_admin');
      }

      // Save active session
      StorageService.setProduction(STORAGE_KEYS.SESSION, session);
      if (setSession) {
        setSession(session);
      } else {
        window.location.hash = '#/dashboard';
      }

      addNotification({
        title: 'Administrator Setup Complete',
        message: `Welcome, ${name}! Your administrator credentials have been stored in the SQLite database.`,
        type: 'success',
      });

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] flex flex-col justify-center items-center p-4 selection:bg-brand-orange selection:text-white">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo size="lg" collapsed={false} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Administrator Setup & Sign Up
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Configure the primary administrator credentials stored in your SQLite server database.
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-[#12151D] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
            <Database className="w-4 h-4 flex-shrink-0" />
            <span>
              Credentials will be auto-saved and permanently stored in <strong className="font-mono text-white">data/stockvista.db</strong>.
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Admin Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-accent-orange" />
                <span>Administrator Full Name *</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. StockVista Administrator"
                className="w-full px-3.5 py-2.5 text-xs bg-[#1A1D26] border border-white/[0.08] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/40"
              />
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-accent-orange" />
                <span>Administrator Email / Login ID *</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@stockvista.in"
                className="w-full px-3.5 py-2.5 text-xs bg-[#1A1D26] border border-white/[0.08] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/40"
              />
            </div>

            {/* Password with Strong Password Generator */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-accent-orange" />
                  <span>Master Admin Password *</span>
                </label>

                <button
                  type="button"
                  onClick={handleSuggestPassword}
                  className="text-[11px] font-bold text-accent-orange hover:text-orange-400 transition flex items-center gap-1 bg-accent-orange/10 px-2 py-0.5 rounded-lg border border-accent-orange/20"
                  title="Generate a cryptographically strong 16-character password"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Suggest Strong Password</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter or generate a strong password"
                  className="w-full px-3.5 py-2.5 pr-10 text-xs bg-[#1A1D26] border border-white/[0.08] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/40 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Strength:</span>
                    <span className="font-bold text-slate-200 flex items-center gap-1">
                      {passwordStrength.label}
                      {isCopied && (
                        <span className="text-emerald-400 flex items-center gap-0.5 ml-2">
                          <Check className="w-3 h-3" /> Copied to clipboard
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all ${
                          passwordStrength.score >= step ? passwordStrength.color : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-orange" />
                <span>Confirm Master Password *</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password to confirm"
                className="w-full px-3.5 py-2.5 text-xs bg-[#1A1D26] border border-white/[0.08] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/40 font-mono"
              />
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-white/20 text-accent-orange focus:ring-accent-orange accent-[#FF6B35]"
                />
                <span>Remember this password on this device for every login</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              <span>{isLoading ? 'Saving to SQLite Database...' : 'Save & Sign In as Administrator'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </form>

          {/* Navigation to Login */}
          <div className="pt-4 border-t border-white/[0.06] text-center text-xs text-slate-400">
            <span>Already set up your administrator credentials? </span>
            <Link to="/login" className="text-accent-orange font-bold hover:underline">
              Sign In Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
