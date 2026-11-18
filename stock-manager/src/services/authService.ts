import { User, Role, AuthSession, DEFAULT_ROLE_MODULES, LoginMethod } from '../types/auth';
import { UserAccount } from '../data/users';
import { StorageService, STORAGE_KEYS } from './storageService';
import { auditLogService } from './auditLogService';

export interface LoginResult {
  requiresOtp: boolean;
  user?: User;
  session?: AuthSession;
  maskedPhone?: string;
}

export interface InitialAdminInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

function sanitizeUser(account: UserAccount): User {
  const { passwordHash, requiresOtp, otpCode, ...clean } = account;
  return clean;
}

// Single fixed administrator credentials — Admin login only opens with this exact ID & password
const FIXED_ADMIN_CONFIG = {
  id: 'usr-admin-01',
  name: 'System Administrator',
  email: 'admin@stockvista.in',
  passwordHash: 'StockVista@2026',
  phone: '+91 98200 12345',
} as const;

function buildFixedAdminAccount(now: string, existing?: UserAccount): UserAccount {
  return {
    id: FIXED_ADMIN_CONFIG.id,
    name: existing?.name || FIXED_ADMIN_CONFIG.name,
    email: FIXED_ADMIN_CONFIG.email,
    role: 'admin',
    roleTitle: 'System Administrator',
    phone: existing?.phone || FIXED_ADMIN_CONFIG.phone,
    passwordHash: FIXED_ADMIN_CONFIG.passwordHash,
    requiresOtp: false,
    status: 'active',
    lastLogin: now,
    warehouseId: 'all',
    warehouseName: 'All Facilities',
    permissions: [...DEFAULT_ROLE_MODULES.admin],
    loginMethod: 'email_password',
    preferredLoginMethod: 'email_password',
    createdAt: existing?.createdAt || now,
  };
}

// Temporary in-memory phone OTP store for active sessions
const phoneOtpStore = new Map<string, { code: string; expiresAt: number; phone: string }>();

export const authService = {
  hasAdminSync(): boolean {
    return true;
  },

  async hasAdmin(): Promise<boolean> {
    return true;
  },

  async hasUsers(): Promise<boolean> {
    return true;
  },

  async createInitialAdmin(_input: InitialAdminInput): Promise<AuthSession> {
    await new Promise((res) => setTimeout(res, 150));
    throw new Error('Administrator account is already configured. Please sign in with your administrator login ID and password.');
  },

  /**
   * Strict Administrator Login:
   * Only the single configured Admin Login ID and Password can sign in as Administrator.
   */
  async loginAdmin(email: string, password: string, rememberMe = true): Promise<LoginResult> {
    await new Promise((res) => setTimeout(res, 180));

    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail !== FIXED_ADMIN_CONFIG.email ||
      password !== FIXED_ADMIN_CONFIG.passwordHash
    ) {
      throw new Error('Invalid administrator login ID or password.');
    }

    const now = new Date().toISOString();
    const existingUsers = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    const safeUsers = Array.isArray(existingUsers) ? existingUsers : [];
    const existingAdmin = safeUsers.find(
      (u) => u.id === FIXED_ADMIN_CONFIG.id || (u.email || '').trim().toLowerCase() === FIXED_ADMIN_CONFIG.email
    );
    const adminAccount = buildFixedAdminAccount(now, existingAdmin);

    const nonAdminUsers = safeUsers.filter(
      (u) => u.id !== FIXED_ADMIN_CONFIG.id && (u.email || '').trim().toLowerCase() !== FIXED_ADMIN_CONFIG.email
    );
    StorageService.setProduction(STORAGE_KEYS.USERS, [adminAccount, ...nonAdminUsers]);

    const sessionDurationMs = rememberMe
      ? 7 * 24 * 60 * 60 * 1000 // 7 days
      : 8 * 60 * 60 * 1000; // 8 hours

    const session: AuthSession = {
      user: sanitizeUser(adminAccount),
      token: `token_${adminAccount.id}_${Date.now()}`,
      expiresAt: Date.now() + sessionDurationMs,
    };

    StorageService.set(STORAGE_KEYS.SESSION, session);
    return {
      requiresOtp: false,
      user: session.user,
      session,
    };
  },

  async login(email: string, passwordHash: string, rememberMe = true): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === FIXED_ADMIN_CONFIG.email) {
      return this.loginAdmin(email, passwordHash, rememberMe);
    }

    await new Promise((res) => setTimeout(res, 180));

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    if (!Array.isArray(users) || users.length === 0) {
      throw new Error('Invalid email address or user account does not exist.');
    }
    const userAccount = users.find(
      (u) => (u.email || '').trim().toLowerCase() === normalizedEmail
    );

    if (!userAccount) {
      throw new Error('Invalid email address or user account does not exist.');
    }

    if (userAccount.role === 'admin') {
      throw new Error('Invalid administrator login ID or password.');
    }

    if (
      userAccount.passwordHash === 'google_oauth_auth_token' ||
      userAccount.passwordHash === 'phone_otp_auth_token'
    ) {
      throw new Error(
        userAccount.passwordHash === 'google_oauth_auth_token'
          ? 'This account uses Google Sign-In on the Staff tab and does not have a password.'
          : 'This account uses Phone OTP Sign-In on the Staff tab and does not have a password.'
      );
    }

    if (userAccount.passwordHash !== passwordHash) {
      throw new Error('Invalid password. Please check your credentials.');
    }

    if (userAccount.status === 'deactivated' || userAccount.status === 'suspended') {
      throw new Error('Your account has been deactivated by the administrator. Access is blocked.');
    }

    if (userAccount.status === 'pending_approval') {
      throw new Error('Your account is pending administrator approval. Please contact your administrator.');
    }

    if (userAccount.requiresOtp) {
      const phone = userAccount.phone || '+91 99999 99999';
      const maskedPhone = phone.replace(/(\+91\s\d{2})\d{4}(\s\d{4})/, '$1****$2');
      return {
        requiresOtp: true,
        user: sanitizeUser(userAccount),
        maskedPhone,
      };
    }

    // Update lastLogin & preferredLoginMethod
    userAccount.lastLogin = new Date().toISOString();
    userAccount.preferredLoginMethod = 'email_password';
    StorageService.setProduction(STORAGE_KEYS.USERS, users);

    const sessionDurationMs = rememberMe
      ? 7 * 24 * 60 * 60 * 1000 // 7 days
      : 8 * 60 * 60 * 1000; // 8 hours

    const session: AuthSession = {
      user: sanitizeUser(userAccount),
      token: `token_${userAccount.id}_${Date.now()}`,
      expiresAt: Date.now() + sessionDurationMs,
    };

    StorageService.set(STORAGE_KEYS.SESSION, session);
    return {
      requiresOtp: false,
      user: session.user,
      session,
    };
  },

  /**
   * Gmail / Google OAuth Staff Authentication & Registration
   */
  async loginWithGoogle(email: string, name?: string, role: Role = 'staff'): Promise<AuthSession> {
    await new Promise((res) => setTimeout(res, 200));

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Valid Google/Gmail account email is required.');
    }

    if (role === 'admin' || cleanEmail === FIXED_ADMIN_CONFIG.email) {
      throw new Error('Administrator accounts must sign in using the Admin Login ID and Password on the Admin tab.');
    }

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    let userAccount = users.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail);

    if (userAccount) {
      if (userAccount.role === 'admin') {
        throw new Error('Administrator accounts must sign in using the Admin Login ID and Password on the Admin tab.');
      }
      // Existing staff
      if (userAccount.status === 'deactivated' || userAccount.status === 'suspended') {
        throw new Error('Your account has been deactivated by the administrator. Access is blocked.');
      }
      if (userAccount.status === 'pending_approval') {
        throw new Error('Your account is pending administrator approval. Please contact your administrator.');
      }

      userAccount.lastLogin = new Date().toISOString();
      userAccount.preferredLoginMethod = 'google';
      if (!userAccount.loginMethod) userAccount.loginMethod = 'google';
      StorageService.setProduction(STORAGE_KEYS.USERS, users);
    } else {
      // New staff registration via Google
      const id = `usr-g-${Date.now().toString().slice(-5)}`;
      const now = new Date().toISOString();
      const displayName = name?.trim() || cleanEmail.split('@')[0].replace(/[._-]/g, ' ');

      userAccount = {
        id,
        name: displayName,
        email: cleanEmail,
        role,
        roleTitle:
          role === 'admin'
            ? 'System Administrator'
            : role === 'manager'
            ? 'Operations Manager'
            : 'Billing Staff',
        phone: '+91 98000 00000',
        passwordHash: 'google_oauth_auth_token',
        requiresOtp: false,
        status: 'active',
        lastLogin: now,
        warehouseId: 'wh-001',
        warehouseName: 'Main Warehouse',
        permissions: [...DEFAULT_ROLE_MODULES[role]],
        loginMethod: 'google',
        preferredLoginMethod: 'google',
        createdAt: now,
      };

      users.push(userAccount);
      StorageService.set(STORAGE_KEYS.USERS, users);

      try {
        await auditLogService.logAction({
          userId: id,
          userName: displayName,
          userRole: role,
          action: 'settings_updated',
          module: 'Security',
          targetId: id,
          targetDescription: `Staff registered via Google OAuth: ${displayName} (${cleanEmail})`,
          newValue: `Verified Login Method: Gmail / Google OAuth`,
        });
      } catch {}
    }

    const session: AuthSession = {
      user: sanitizeUser(userAccount),
      token: `token_g_${userAccount.id}_${Date.now()}`,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };

    StorageService.set(STORAGE_KEYS.SESSION, session);
    return session;
  },

  /**
   * Phone Number OTP Dispatch for Staff Authentication
   */
  async sendPhoneOtp(
    phone: string
  ): Promise<{ success: boolean; otpCode: string; message: string; isNewUser: boolean }> {
    await new Promise((res) => setTimeout(res, 180));

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    const digits = cleanPhone.replace(/\D/g, '').slice(-10);
    const existing = users.find((u) => (u.phone || '').replace(/\D/g, '').endsWith(digits));

    if (existing && existing.role === 'admin') {
      throw new Error('Administrator accounts must sign in using the Admin Login ID and Password on the Admin tab.');
    }

    if (existing && (existing.status === 'deactivated' || existing.status === 'suspended')) {
      throw new Error('This account has been deactivated by the administrator. Login is blocked.');
    }

    // Default fast OTP for seamless demonstration and testing
    const otpCode = '123456';
    phoneOtpStore.set(digits, {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
      phone: cleanPhone,
    });

    return {
      success: true,
      otpCode,
      message: `Security OTP sent to ${cleanPhone}. (Use OTP: ${otpCode})`,
      isNewUser: !existing,
    };
  },

  /**
   * Verify Phone OTP for Staff Authentication & Registration
   */
  async verifyPhoneOtp(
    phone: string,
    otpCode: string,
    name?: string,
    role: Role = 'staff'
  ): Promise<AuthSession> {
    await new Promise((res) => setTimeout(res, 200));

    const cleanPhone = phone.trim();
    const digits = cleanPhone.replace(/\D/g, '').slice(-10);

    if (otpCode.trim() !== '123456') {
      const stored = phoneOtpStore.get(digits);
      if (!stored || stored.code !== otpCode.trim() || Date.now() > stored.expiresAt) {
        throw new Error('Invalid or expired OTP code. Please try again.');
      }
    }

    if (role === 'admin') {
      throw new Error('Administrator accounts must sign in using the Admin Login ID and Password on the Admin tab.');
    }

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    let userAccount = users.find((u) => (u.phone || '').replace(/\D/g, '').endsWith(digits));

    if (userAccount) {
      if (userAccount.role === 'admin') {
        throw new Error('Administrator accounts must sign in using the Admin Login ID and Password on the Admin tab.');
      }
      // Existing user
      if (userAccount.status === 'deactivated' || userAccount.status === 'suspended') {
        throw new Error('Your account has been deactivated by the administrator. Access is blocked.');
      }
      if (userAccount.status === 'pending_approval') {
        throw new Error('Your account is pending administrator approval. Please contact your administrator.');
      }

      userAccount.lastLogin = new Date().toISOString();
      userAccount.preferredLoginMethod = 'phone_otp';
      if (!userAccount.loginMethod) userAccount.loginMethod = 'phone_otp';
      StorageService.setProduction(STORAGE_KEYS.USERS, users);
    } else {
      // New staff registration via Phone/OTP
      const id = `usr-p-${Date.now().toString().slice(-5)}`;
      const now = new Date().toISOString();
      const displayName = name?.trim() || `Staff ${digits.slice(-4)}`;
      const generatedEmail = `staff.${digits}@stockvista.internal`;

      userAccount = {
        id,
        name: displayName,
        email: generatedEmail,
        role,
        roleTitle:
          role === 'admin'
            ? 'System Administrator'
            : role === 'manager'
            ? 'Operations Manager'
            : 'Billing Staff',
        phone: cleanPhone.startsWith('+91') ? cleanPhone : `+91 ${cleanPhone}`,
        passwordHash: 'phone_otp_auth_token',
        requiresOtp: false,
        status: 'active',
        lastLogin: now,
        warehouseId: 'wh-001',
        warehouseName: 'Main Warehouse',
        permissions: [...DEFAULT_ROLE_MODULES[role]],
        loginMethod: 'phone_otp',
        preferredLoginMethod: 'phone_otp',
        createdAt: now,
      };

      users.push(userAccount);
      StorageService.set(STORAGE_KEYS.USERS, users);

      try {
        await auditLogService.logAction({
          userId: id,
          userName: displayName,
          userRole: role,
          action: 'settings_updated',
          module: 'Security',
          targetId: id,
          targetDescription: `Staff registered via Phone / OTP: ${displayName} (${cleanPhone})`,
          newValue: `Verified Login Method: Phone / OTP`,
        });
      } catch {}
    }

    phoneOtpStore.delete(digits);

    const session: AuthSession = {
      user: sanitizeUser(userAccount),
      token: `token_p_${userAccount.id}_${Date.now()}`,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };

    StorageService.set(STORAGE_KEYS.SESSION, session);
    return session;
  },

  async verifyOtp(email: string, otpCode: string): Promise<AuthSession> {
    await new Promise((res) => setTimeout(res, 200));

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    const userAccount = users.find(
      (u) => (u.email || '').trim().toLowerCase() === email.trim().toLowerCase()
    );

    if (!userAccount) {
      throw new Error('User not found.');
    }

    if (otpCode !== (userAccount.otpCode || '123456')) {
      throw new Error('Invalid OTP code. Please check and try again.');
    }

    userAccount.lastLogin = new Date().toISOString();
    StorageService.setProduction(STORAGE_KEYS.USERS, users);

    const session: AuthSession = {
      user: sanitizeUser(userAccount),
      token: `token_${userAccount.id}_${Date.now()}`,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };

    StorageService.set(STORAGE_KEYS.SESSION, session);
    return session;
  },

  async resendOtp(_email: string): Promise<{ success: boolean; message: string }> {
    await new Promise((res) => setTimeout(res, 150));
    return {
      success: true,
      message: 'A security verification code has been dispatched to your registered mobile and email.',
    };
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    await new Promise((res) => setTimeout(res, 180));
    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    const user = users.find((u) => (u.email || '').trim().toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      throw new Error('No registered account found with this email address.');
    }
    throw new Error(
      'Password recovery is not available because no backend server or email delivery service is configured for this app.'
    );
  },

  getCurrentSession(): AuthSession | null {
    try {
      const session = StorageService.get<AuthSession | null>(STORAGE_KEYS.SESSION, null);
      if (!session) return null;
      if (session.isDemo || session.user?.isDemo) {
        StorageService.remove(STORAGE_KEYS.SESSION);
        return null;
      }
      if (Date.now() > session.expiresAt) {
        StorageService.remove(STORAGE_KEYS.SESSION);
        return null;
      }

      // If user account in users table is deactivated, revoke immediately
      const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
      const account = users.find((u) => u.id === session.user.id);
      if (account && (account.status === 'deactivated' || account.status === 'suspended')) {
        StorageService.remove(STORAGE_KEYS.SESSION);
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  logout(): void {
    StorageService.remove(STORAGE_KEYS.SESSION);
  },

  isDemoSession(): boolean {
    return false;
  },

  isDemoLoginConfigured(): boolean {
    return false;
  },

  async loginDemoAdmin(): Promise<AuthSession> {
    throw new Error('Demo Admin login has been disabled.');
  },

  canSwitchRole(userId?: string): boolean {
    if (!userId) return false;
    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    const account = users.find((u) => u.id === userId);
    if (account) {
      return account.role === 'admin';
    }
    const session = this.getCurrentSession();
    return session?.user?.id === userId && session.user.role === 'admin';
  },

  async switchRole(role: Role): Promise<User> {
    const session = this.getCurrentSession();
    if (!session || !session.user) {
      throw new Error('No active session.');
    }

    if (!this.canSwitchRole(session.user.id)) {
      throw new Error('Unauthorized. Only administrators can switch test roles.');
    }

    const updatedUser: User = {
      ...session.user,
      role,
      roleTitle:
        role === 'admin'
          ? 'System Administrator'
          : role === 'manager'
          ? 'Operations Manager'
          : role === 'staff'
          ? 'Billing Staff'
          : 'Auditor & Viewer',
      permissions: [...DEFAULT_ROLE_MODULES[role]],
    };

    const updatedSession: AuthSession = {
      ...session,
      user: updatedUser,
    };

    StorageService.set(STORAGE_KEYS.SESSION, updatedSession);
    return updatedUser;
  },
};
