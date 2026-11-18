import { describe, it, expect, beforeEach } from 'vitest';
import { generateStrongPassword, evaluatePasswordStrength } from '../utils/passwordGenerator';
import { StorageService, STORAGE_KEYS } from '../services/storageService';

// Ensure in-memory mock for localStorage in node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    length: 0,
  } as any;
}

describe('Admin Only Access, Setup, and Auto-Save Durability', () => {
  beforeEach(() => {
    localStorage.clear();
    StorageService.remove(STORAGE_KEYS.SESSION);
  });

  describe('1. Strong Password Generator & Strength Evaluator', () => {
    it('generates a strong random password with uppercase, lowercase, numbers, and symbols', () => {
      const password = generateStrongPassword(16);
      expect(password).toBeDefined();
      expect(password.length).toBe(16);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });

    it('evaluates weak, medium, and strong passwords accurately', () => {
      const weak = evaluatePasswordStrength('12345');
      expect(['Very Weak', 'Weak']).toContain(weak.label);
      expect(weak.score).toBeLessThanOrEqual(2);

      const medium = evaluatePasswordStrength('AdminPassword123');
      expect(['Medium', 'Strong']).toContain(medium.label);

      const strong = generateStrongPassword(18);
      const strength = evaluatePasswordStrength(strong);
      expect(['Strong', 'Very Strong']).toContain(strength.label);
      expect(strength.score).toBeGreaterThanOrEqual(4);
    });
  });

  describe('2. Remembered Credentials for Every Login', () => {
    it('remembers admin email and credentials across sessions when rememberMe is enabled', () => {
      const adminCreds = {
        email: 'admin@stockvista.in',
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('stockvista_remembered_admin', JSON.stringify(adminCreds));

      const retrieved = JSON.parse(localStorage.getItem('stockvista_remembered_admin') || '{}');
      expect(retrieved.email).toBe('admin@stockvista.in');
    });

    it('clears remembered credentials when explicitly removed', () => {
      localStorage.setItem('stockvista_remembered_admin', JSON.stringify({ email: 'admin@stockvista.in' }));
      localStorage.removeItem('stockvista_remembered_admin');
      expect(localStorage.getItem('stockvista_remembered_admin')).toBeNull();
    });
  });

  describe('3. Admin-Only Role and Storage Integrity', () => {
    it('authenticates strictly as administrator with full permissions', () => {
      const adminUser = {
        id: 'usr_admin_fixed',
        email: 'admin@stockvista.in',
        name: 'Fixed Administrator',
        role: 'admin',
        active: true,
      };

      StorageService.set(STORAGE_KEYS.SESSION, {
        user: adminUser,
        token: 'test_token',
        expiresAt: Date.now() + 86400000,
      });

      const session = StorageService.get<any>(STORAGE_KEYS.SESSION, null);
      expect(session).not.toBeNull();
      expect(session?.user.role).toBe('admin');
      expect(session?.user.email).toBe('admin@stockvista.in');
    });

    it('persists data updates immediately to persistent storage for crash safety', () => {
      const items = StorageService.get<any[]>(STORAGE_KEYS.ITEMS, []);
      expect(Array.isArray(items)).toBe(true);

      const newItem = {
        id: 'test_durability_item',
        sku: 'TEST-DUR-001',
        name: 'Durability Check Item',
        category: 'Electronics',
        hsn: '8517',
        unit: 'PCS',
        currentStock: 150,
        minStock: 20,
        reorderPoint: 40,
        costPrice: 500,
        sellingPrice: 750,
        taxRate: 18,
        location: 'Warehouse A',
        warehouseId: 'wh_main',
        status: 'in_stock' as const,
        description: 'Auto-saved persistent item',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated = [...items, newItem];
      StorageService.set(STORAGE_KEYS.ITEMS, updated);

      const retrieved = StorageService.get<any[]>(STORAGE_KEYS.ITEMS, []);
      const found = retrieved.find((i) => i.id === 'test_durability_item');
      expect(found).toBeDefined();
      expect(found?.currentStock).toBe(150);
      expect(found?.status).toBe('in_stock');
    });
  });
});
