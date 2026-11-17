import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Logo } from '../../components/common/Logo';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { OtpModal } from '../../components/auth/OtpModal';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';
import { useAuthStore } from '../../store/authStore';
import { Role, LoginMethod } from '../../types/auth';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  UserCheck,
  KeyRound,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid corporate email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    loginAdmin,
    loginWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    isAuthenticated,
    user,
    isLoading,
    error,
    clearError,
    otpPendingEmail,
  } = useAuthStore();

  const [selectedRoleTab, setSelectedRoleTab] = useState<'admin' | 'staff'>('admin');
  const [staffLoginMethod, setStaffLoginMethod] = useState<LoginMethod>('google');

  // Staff Google OAuth form state
  const [googleEmail, setGoogleEmail] = useState('rahul.deshmukh@gmail.com');
  const [googleName, setGoogleName] = useState('Rahul Deshmukh');

  // Staff Phone OTP form state
  const [phoneInput, setPhoneInput] = useState('9820099887');
  const [phoneNameInput, setPhoneNameInput] = useState('Rahul Deshmukh');
  const [otpInput, setOtpInput] = useState('');
  const [isOtpDispatched, setIsOtpDispatched] = useState(false);
  const [dispatchedOtpHint, setDispatchedOtpHint] = useState<string | null>(null);

  // Common UI states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const locationState = location.state as { from?: { pathname: string }; error?: string } | null;
  const rawFrom = locationState?.from?.pathname;
  const from = rawFrom && rawFrom !== '/login' ? rawFrom : '/dashboard';
  const redirectedError = locationState?.error || null;
  const displayedError = error || redirectedError;

  // Redirect already-authenticated users straight to the app
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, from, navigate]);

  const adminLoginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  const onAdminLoginSubmit = async (data: LoginFormData) => {
    clearError();
    try {
      await loginAdmin(data.email, data.password, data.rememberMe);
      navigate(from, { replace: true });
    } catch {
      // Handled in authStore
    }
  };

  const onLoginSubmit = async (data: LoginFormData) => {
    clearError();
    try {
      const result = await login(data.email, data.password, data.rememberMe);
      if (result.requiresOtp) {
        setShowOtpModal(true);
      } else {
        navigate(from, { replace: true });
      }
    } catch {
      // Handled in authStore
    }
  };

  // Staff Google OAuth Submit
  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!googleEmail.trim()) return;
    try {
      await loginWithGoogle(
        googleEmail.trim(),
        googleName.trim() || undefined,
        selectedRoleTab as Role
      );
      navigate(from, { replace: true });
    } catch {
      // Handled in authStore
    }
  };

  // Staff Phone OTP Dispatch
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!phoneInput.trim()) return;
    try {
      const res = await sendPhoneOtp(phoneInput.trim());
      setIsOtpDispatched(true);
      setDispatchedOtpHint(res.otpCode || '123456');
    } catch {
      // Handled in authStore
    }
  };

  // Staff Phone OTP Verification & Sign In
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!otpInput.trim() || !phoneInput.trim()) return;
    try {
      await verifyPhoneOtp(
        phoneInput.trim(),
        otpInput.trim(),
        phoneNameInput.trim() || undefined,
        selectedRoleTab as Role
      );
      navigate(from, { replace: true });
    } catch {
      // Handled in authStore
    }
  };

  const handleOtpSuccess = () => {
    setShowOtpModal(false);
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-[#F4F7FA] dark:bg-[#05060A] text-slate-800 dark:text-[#F2F4F8] transition-colors relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#8A3A1A]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#3B5BFF]/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Left Column: Brand Hero & Indian Wholesale Context (hidden on small screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0B1F3A] dark:bg-[#070913] text-white flex-col justify-between p-12 relative overflow-hidden border-r border-slate-200/50 dark:border-white/[0.06]">
        <div className="relative z-10">
          <Logo size="lg" className="text-white" showWordmark={true} />
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 dark:bg-white/[0.06] border border-white/15 text-xs font-semibold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
            <span>Enterprise B2B Wholesale Inventory & Billing</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
            Streamlined Warehouse Logistics & Multi-State GST Billing
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed">
            Real-time multi-hub stock management, compliant statutory e-Invoicing, and high-velocity B2B distribution tailored for Indian wholesale enterprises.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>AS-2 Inventory Valuation</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>CGST, SGST & IGST Ledgers</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>Role-Based Access Control</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">✓</div>
              <span>Audit Trail & Ledger Logs</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-6">
          <span>Enterprise Release 2.1 • FY 2026-27</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            256-bit Encrypted Ledger
          </span>
        </div>
      </div>

      {/* Right Column: Form Area */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden mb-4">
            <Logo size="md" showWordmark={true} />
          </div>

          {/* ROLE SELECTOR PILLS (Admin / Staff - Manager removed per request) */}
          <div className="flex items-center justify-between p-1.5 bg-slate-200/70 dark:bg-white/[0.05] rounded-full border border-slate-300/60 dark:border-white/10 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setSelectedRoleTab('admin');
                clearError();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs font-bold transition-all ${
                selectedRoleTab === 'admin'
                  ? 'bg-white dark:bg-[#1E2230] text-slate-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="text-sm">👑</span>
              <span>Admin</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoleTab('staff');
                clearError();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs font-bold transition-all ${
                selectedRoleTab === 'staff'
                  ? 'bg-white dark:bg-[#1E2230] text-slate-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="text-sm">📦</span>
              <span>Staff</span>
            </button>
          </div>

          {/* ============================================================ */}
          {/* TAB 1: ADMIN LOGIN (FIXED ADMIN ID & PASSWORD ONLY)          */}
          {/* ============================================================ */}
          {selectedRoleTab === 'admin' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-[#F2F4F8] tracking-tight">
                  Admin Sign-In
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9AA0AE] mt-1">
                  Enter your administrator Login ID and Password to access the workspace.
                </p>
              </div>

              <form onSubmit={adminLoginForm.handleSubmit(onAdminLoginSubmit)} className="space-y-3.5">
                <Input
                  label="Admin Login ID"
                  type="email"
                  placeholder="Enter administrator login ID"
                  leftIcon={<Mail className="w-4 h-4" strokeWidth={1.5} />}
                  error={adminLoginForm.formState.errors.email?.message}
                  {...adminLoginForm.register('email')}
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  leftIcon={<Lock className="w-4 h-4" strokeWidth={1.5} />}
                  error={adminLoginForm.formState.errors.password?.message}
                  {...adminLoginForm.register('password')}
                />

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-600 dark:text-[#9AA0AE] cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-orange focus:ring-brand-orange accent-[#FF6B35]"
                      {...adminLoginForm.register('rememberMe')}
                    />
                    <span>Remember this terminal</span>
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
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: STAFF AUTHENTICATION SYSTEM                           */}
          {/* ============================================================ */}
          {selectedRoleTab === 'staff' && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-accent-blue text-xs font-bold border border-blue-500/20 mb-2">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Billing & Floor Staff Portal</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-[#F2F4F8] tracking-tight">
                  Staff Sign-In
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9AA0AE] mt-1">
                  Choose your preferred registration/login method to access your assigned modules:
                </p>
              </div>

              {/* Login Method Sub-tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 dark:bg-white/[0.04] rounded-xl border border-slate-300/60 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setStaffLoginMethod('google');
                    clearError();
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    staffLoginMethod === 'google'
                      ? 'bg-white dark:bg-[#1A1D26] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="font-bold text-blue-500">G</span>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStaffLoginMethod('phone_otp');
                    clearError();
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    staffLoginMethod === 'phone_otp'
                      ? 'bg-white dark:bg-[#1A1D26] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Phone OTP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStaffLoginMethod('email_password');
                    clearError();
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    staffLoginMethod === 'email_password'
                      ? 'bg-white dark:bg-[#1A1D26] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Password</span>
                </button>
              </div>

              {/* METHOD A: GMAIL / GOOGLE OAUTH */}
              {staffLoginMethod === 'google' && (
                <form onSubmit={handleGoogleSubmit} className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-blue-500/[0.08] border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Google OAuth Authentication</p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-300/80 mt-0.5">
                        Staff can sign in or register with their verified Google/Gmail address. Verified credentials will be remembered for all future sessions.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name (For initial registration)
                    </label>
                    <input
                      type="text"
                      value={googleName}
                      onChange={(e) => setGoogleName(e.target.value)}
                      placeholder="e.g. Rahul Deshmukh"
                      className="w-full px-3 py-2.5 text-xs template-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Google / Gmail Account *
                    </label>
                    <input
                      type="email"
                      required
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      placeholder="e.g. staff.member@gmail.com"
                      className="w-full px-3 py-2.5 text-xs template-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/30"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span className="w-4 h-4 rounded-full bg-white text-blue-600 font-extrabold flex items-center justify-center text-[10px]">
                      G
                    </span>
                    <span>Continue with Google</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </button>
                </form>
              )}

              {/* METHOD B: PHONE NUMBER + OTP */}
              {staffLoginMethod === 'phone_otp' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
                    <Smartphone className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Mobile OTP Authentication</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-300/80 mt-0.5">
                        Log in using your registered 10-digit mobile number with instant one-time SMS verification.
                      </p>
                    </div>
                  </div>

                  {!isOtpDispatched ? (
                    <form onSubmit={handleSendPhoneOtp} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Full Name (Optional for first-time login)
                        </label>
                        <input
                          type="text"
                          value={phoneNameInput}
                          onChange={(e) => setPhoneNameInput(e.target.value)}
                          placeholder="e.g. Rahul Deshmukh"
                          className="w-full px-3 py-2.5 text-xs template-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/30"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          10-Digit Mobile Number *
                        </label>
                        <div className="flex gap-2">
                          <span className="px-3 py-2.5 bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center">
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="98200 12345"
                            className="flex-1 px-3 py-2.5 text-xs template-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/30"
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading || phoneInput.length < 10}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Send 6-Digit OTP</span>
                        <ArrowRight className="w-4 h-4 ml-auto" />
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyPhoneOtp} className="space-y-3.5">
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>OTP sent to +91 {phoneInput}</span>
                        </div>
                        {dispatchedOtpHint && (
                          <span className="font-mono font-bold bg-white dark:bg-white/10 px-2 py-0.5 rounded border border-emerald-500/30">
                            Code: {dispatchedOtpHint}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Enter 6-Digit Verification Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          autoFocus
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          className="w-full text-center tracking-widest font-mono text-base font-bold px-3 py-2.5 template-input border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-orange/30"
                        />
                      </div>

                      {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOtpDispatched(false);
                            setOtpInput('');
                            clearError();
                          }}
                          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition"
                        >
                          Change Number
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading || otpInput.length < 4}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <KeyRound className="w-4 h-4" />
                          <span>Verify & Sign In</span>
                          <ArrowRight className="w-4 h-4 ml-auto" />
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* METHOD C: WORK EMAIL & PASSWORD */}
              {staffLoginMethod === 'email_password' && (
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-3.5">
                  <Input
                    label="Corporate Work Email"
                    type="email"
                    placeholder="staff@stockvista.in"
                    leftIcon={<Mail className="w-4 h-4" strokeWidth={1.5} />}
                    error={loginForm.formState.errors.email?.message}
                    {...loginForm.register('email')}
                  />

                  <Input
                    label="Account Password"
                    type="password"
                    placeholder="••••••••"
                    leftIcon={<Lock className="w-4 h-4" strokeWidth={1.5} />}
                    error={loginForm.formState.errors.password?.message}
                    {...loginForm.register('password')}
                  />

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-600 dark:text-[#9AA0AE] cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-brand-orange focus:ring-brand-orange accent-[#FF6B35]"
                        {...loginForm.register('rememberMe')}
                      />
                      <span>Remember credentials</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-brand-orange font-semibold hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
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
                    Sign In to Assigned Modules
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <OtpModal
        isOpen={showOtpModal || !!otpPendingEmail}
        onClose={() => setShowOtpModal(false)}
        onSuccess={handleOtpSuccess}
      />

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
};

export default LoginPage;
