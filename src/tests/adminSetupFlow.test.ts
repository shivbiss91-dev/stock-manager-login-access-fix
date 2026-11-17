import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../services/authService';
import { backupService } from '../services/backupService';
import { StorageService, STORAGE_KEYS } from '../services/storageService';
import { UserAccount } from '../data/users';

describe('Fixed Administrator Login & Access Protection', () => {
  beforeEach(() => {
    StorageService.remove(STORAGE_KEYS.SESSION);
    StorageService.setProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
  });

  it('opens Administrator access with the exact configured Admin ID and Password', async () => {
    const result = await authService.loginAdmin('  ADMIN@StockVista.in ', 'StockVista@2026', true);

    expect(result.requiresOtp).toBe(false);
    expect(result.user?.role).toBe('admin');
    expect(result.user?.email).toBe('admin@stockvista.in');
    expect(result.session).toBeDefined();
    expect(result.session!.expiresAt - Date.now()).toBeGreaterThan(24 * 60 * 60 * 1000);

    authService.logout();
    const shortResult = await authService.loginAdmin('admin@stockvista.in', 'StockVista@2026', false);
    expect(shortResult.session!.expiresAt - Date.now()).toBeLessThanOrEqual(8 * 60 * 60 * 1000 + 5000);
  });

  it('strictly rejects wrong password, unknown email, or other admin records', async () => {
    await expect(
      authService.loginAdmin('admin@stockvista.in', 'wrongpass')
    ).rejects.toThrow('Invalid administrator login ID or password.');

    await expect(
      authService.loginAdmin('other@company.in', 'StockVista@2026')
    ).rejects.toThrow('Invalid administrator login ID or password.');

    await expect(
      authService.createInitialAdmin({
        name: 'Another Admin',
        email: 'another@company.in',
        phone: '+91 98200 11111',
        password: 'Password1!',
      })
    ).rejects.toThrow('Administrator account is already configured.');
  });

  it('blocks opening the admin account through Google OAuth or Phone OTP on the Staff tab', async () => {
    await authService.loginAdmin('admin@stockvista.in', 'StockVista@2026');
    authService.logout();

    await expect(
      authService.loginWithGoogle('admin@stockvista.in', 'Admin', 'staff')
    ).rejects.toThrow('Administrator accounts must sign in using the Admin Login ID and Password');

    await expect(
      authService.loginWithGoogle('anyone@gmail.com', 'Anyone', 'admin')
    ).rejects.toThrow('Administrator accounts must sign in using the Admin Login ID and Password');

    await expect(
      authService.sendPhoneOtp('9820012345')
    ).rejects.toThrow('Administrator accounts must sign in using the Admin Login ID and Password');

    await expect(
      authService.verifyPhoneOtp('9820012345', '123456', 'Admin', 'staff')
    ).rejects.toThrow('Administrator accounts must sign in using the Admin Login ID and Password');
  });

  it('preserves existing staff accounts when the fixed admin signs in', async () => {
    await authService.loginWithGoogle('staff.member@gmail.com', 'Staff Member', 'staff');
    authService.logout();

    await authService.loginAdmin('admin@stockvista.in', 'StockVista@2026');

    const users = StorageService.getProduction<UserAccount[]>(STORAGE_KEYS.USERS, []);
    expect(users.some((u) => u.email === 'admin@stockvista.in' && u.role === 'admin')).toBe(true);
    expect(users.some((u) => u.email === 'staff.member@gmail.com' && u.role === 'staff')).toBe(true);
  });

  it('allows the admin to switch to staff view and back to admin, while blocking staff elevation', async () => {
    const adminLogin = await authService.loginAdmin('admin@stockvista.in', 'StockVista@2026');
    expect(authService.canSwitchRole(adminLogin.user!.id)).toBe(true);

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
    await authService.loginAdmin('admin@stockvista.in', 'StockVista@2026');

    await expect(authService.forgotPassword('admin@stockvista.in')).rejects.toThrow(
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
    const itemsBeforeConfirm = StorageService.get<any[]>(STORAGE_KEYS.ITEMS, []);
    expect(itemsBeforeConfirm[0].id).toBe('existing-1');

    const restored = await backupService.restoreSnapshot(backupPayload);
    expect(restored.success).toBe(true);
    const itemsAfterConfirm = StorageService.get<any[]>(STORAGE_KEYS.ITEMS, []);
    expect(itemsAfterConfirm[0].id).toBe('restored-1');
  });
});
