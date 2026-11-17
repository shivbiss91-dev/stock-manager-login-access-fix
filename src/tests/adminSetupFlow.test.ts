import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../services/authService';
import { backupService } from '../services/backupService';
import { StorageService, STORAGE_KEYS } from '../services/storageService';
import { UserAccount } from '../data/users';

describe('Administrator Login & Initial Setup Flow', () => {
  beforeEach(() => {
    StorageService.remove(STORAGE_KEYS.SESSION);
    StorageService.setProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
  });

  it('allows creating the initial administrator account when no account exists', async () => {
    expect(authService.hasAdminSync()).toBe(false);
    expect(await authService.hasAdmin()).toBe(false);

    const session = await authService.createInitialAdmin({
      name: 'Primary Owner',
      email: 'owner@company.in',
      phone: '+91 98200 12345',
      password: 'StrongPassword@1',
    });

    expect(session.user.role).toBe('admin');
    expect(session.user.email).toBe('owner@company.in');
    expect(authService.hasAdminSync()).toBe(true);
    expect(await authService.hasAdmin()).toBe(true);

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('owner@company.in');
  });

  it('blocks creating a second initial administrator account and preserves existing admin data', async () => {
    await authService.createInitialAdmin({
      name: 'First Admin',
      email: 'first.admin@company.in',
      phone: '+91 98200 11111',
      password: 'Password1!',
    });

    authService.logout();

    await expect(
      authService.createInitialAdmin({
        name: 'Second Admin',
        email: 'second.admin@company.in',
        phone: '+91 98200 22222',
        password: 'Password2!',
      })
    ).rejects.toThrow(
      'Initial administrator account already exists. Please log in with existing credentials.'
    );

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('first.admin@company.in');

    const loginResult = await authService.login('first.admin@company.in', 'Password1!');
    expect(loginResult.requiresOtp).toBe(false);
    expect(loginResult.user?.email).toBe('first.admin@company.in');
  });

  it('preserves existing staff users if initial admin is created after a staff login', async () => {
    await authService.loginWithGoogle('staff.member@gmail.com', 'Staff Member', 'staff');
    authService.logout();

    expect(await authService.hasAdmin()).toBe(false);

    await authService.createInitialAdmin({
      name: 'Workspace Admin',
      email: 'admin@company.in',
      phone: '+91 98200 33333',
      password: 'AdminPassword@1',
    });

    expect(await authService.hasAdmin()).toBe(true);

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    expect(users).toHaveLength(2);
    expect(users.some((u) => u.email === 'admin@company.in' && u.role === 'admin')).toBe(true);
    expect(users.some((u) => u.email === 'staff.member@gmail.com' && u.role === 'staff')).toBe(true);
  });

  it('still detects the existing production admin even if a legacy demo session exists in storage', async () => {
    await authService.createInitialAdmin({
      name: 'Real Admin',
      email: 'real.admin@company.in',
      phone: '+91 98200 44444',
      password: 'RealPassword@1',
    });

    StorageService.set(STORAGE_KEYS.SESSION, {
      user: { id: 'usr-demo-sweedal-01', name: 'Sweedal – Demo Admin', role: 'admin', isDemo: true },
      token: 'legacy_demo',
      expiresAt: Date.now() + 60_000,
      isDemo: true,
    });

    expect(authService.hasAdminSync()).toBe(true);
    expect(await authService.hasAdmin()).toBe(true);
    expect(authService.getCurrentSession()).toBeNull();

    const loginResult = await authService.login('real.admin@company.in', 'RealPassword@1');
    expect(loginResult.user?.email).toBe('real.admin@company.in');
    expect(StorageService.isDemoActive()).toBe(false);
  });

  it('handles trimmed/case-insensitive admin email login and honors rememberMe duration', async () => {
    await authService.createInitialAdmin({
      name: 'Primary Admin',
      email: 'Admin.Owner@Company.IN',
      phone: '+91 98200 55555',
      password: 'MySecretPassword',
    });
    authService.logout();

    const shortLogin = await authService.login('  admin.owner@company.in  ', 'MySecretPassword', false);
    expect(shortLogin.session).toBeDefined();
    expect(shortLogin.session!.expiresAt - Date.now()).toBeLessThanOrEqual(8 * 60 * 60 * 1000 + 5000);

    authService.logout();
    const longLogin = await authService.login('ADMIN.OWNER@COMPANY.IN ', 'MySecretPassword', true);
    expect(longLogin.session).toBeDefined();
    expect(longLogin.session!.expiresAt - Date.now()).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it('allows a real admin to switch to staff view and switch back to admin, while blocking staff elevation', async () => {
    const adminSession = await authService.createInitialAdmin({
      name: 'Root Admin',
      email: 'root@company.in',
      phone: '+91 98200 66666',
      password: 'RootPassword',
    });

    expect(authService.canSwitchRole(adminSession.user.id)).toBe(true);

    const asStaff = await authService.switchRole('staff');
    expect(asStaff.role).toBe('staff');
    expect(authService.canSwitchRole(asStaff.id)).toBe(true);

    const backToAdmin = await authService.switchRole('admin');
    expect(backToAdmin.role).toBe('admin');

    authService.logout();
    const staffSession = await authService.loginWithGoogle('worker@gmail.com', 'Worker', 'staff');
    expect(authService.canSwitchRole(staffSession.user.id)).toBe(false);
    await expect(authService.switchRole('admin')).rejects.toThrow('Unauthorized');
  });

  it('reports clearly that password recovery is unavailable instead of pretending an email was sent', async () => {
    await authService.createInitialAdmin({
      name: 'Admin User',
      email: 'admin@company.in',
      phone: '+91 98200 77777',
      password: 'Password123',
    });

    await expect(authService.forgotPassword('admin@company.in')).rejects.toThrow(
      'Password recovery is not available'
    );
  });

  it('validates backup snapshots without overwriting active data until restoreSnapshot is confirmed', async () => {
    StorageService.set(STORAGE_KEYS.ITEMS, [{ id: 'existing-1', name: 'Original Item' }]);

    const backupPayload = JSON.stringify({
      version: '2.1.0',
      timestamp: new Date().toISOString(),
      environment: 'Test',
      metadata: { itemsCount: 1, customersCount: 0, suppliersCount: 0, invoicesCount: 0, warehousesCount: 0 },
      data: {
        items: [{ id: 'restored-1', name: 'Restored Item' }],
        customers: [],
        suppliers: [],
        invoices: [],
        warehouses: [],
        materials: [],
      },
    });

    const validation = backupService.validateSnapshot(backupPayload);
    expect(validation.success).toBe(true);
    // Validation must NOT overwrite existing items
    const itemsBeforeConfirm = StorageService.get<any[]>(STORAGE_KEYS.ITEMS, []);
    expect(itemsBeforeConfirm[0].id).toBe('existing-1');

    const restored = await backupService.restoreSnapshot(backupPayload);
    expect(restored.success).toBe(true);
    const itemsAfterConfirm = StorageService.get<any[]>(STORAGE_KEYS.ITEMS, []);
    expect(itemsAfterConfirm[0].id).toBe('restored-1');
  });
});
