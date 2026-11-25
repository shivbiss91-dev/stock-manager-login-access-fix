import { describe, it, expect, beforeEach } from 'vitest';
import { inventoryService } from '../services/inventoryService';
import { stockMovementService } from '../services/stockMovementService';
import { StorageService, STORAGE_KEYS } from '../services/storageService';
import { InventoryItem } from '../types/inventory';

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

describe('Unit Scaling Fix & Movement History Recalculation', () => {
  const TEST_CTN_ITEM_ID = 'item-test-ctn-1000';

  beforeEach(() => {
    localStorage.clear();
    StorageService.remove(STORAGE_KEYS.ITEMS);
    StorageService.remove(STORAGE_KEYS.MOVEMENTS);

    const testItem: InventoryItem = {
      id: TEST_CTN_ITEM_ID,
      sku: 'SKU-CTN-TEST',
      name: 'Industrial Foam Sheets (CTN)',
      materialCategory: 'foam',
      sellingPrice: 1500,
      costPrice: 900,
      currentStock: 1000,
      unit: 'CTN',
      minStock: 100,
      reorderLevel: 200,
      reorderQuantity: 500,
      warehouseId: 'wh_main',
      warehouseName: 'Central Logistics Hub',
      rackLocation: 'Rack C-10',
      stockStatus: 'in_stock',
      gstRate: 18,
      status: 'active',
      description: 'Industrial packaging foam in master cartons',
      images: [],
      packagingConversions: {
        baseUnit: 'PCS',
        dozenMultiplier: 12,
        boxMultiplier: 20,
        cartonMultiplier: 100,
        bundleMultiplier: 25,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageService.set(STORAGE_KEYS.ITEMS, [testItem]);
    StorageService.set(STORAGE_KEYS.MOVEMENTS, []);
  });

  describe('1. 1:1 Unit Scaling in Stock Adjustments (No Hidden Multipliers)', () => {
    it('adds exactly 10 CTN to an item with 1,000 CTN balance without multiplying by 100', async () => {
      const initial = await inventoryService.getItemById(TEST_CTN_ITEM_ID);
      expect(initial?.currentStock).toBe(1000);
      expect(initial?.unit).toBe('CTN');

      // User enters 10 to add in the adjustment modal
      const updated = await inventoryService.updateStock(TEST_CTN_ITEM_ID, {
        mode: 'add',
        adjustmentQuantity: 10,
        delta: 10,
        unit: 'CTN',
        reason: 'Stock Addition (Inward)',
        notes: 'Received 10 cartons',
        userName: 'Admin User',
        userRole: 'admin',
      });

      // Crucial: Must be 1,010 CTN, NOT 2,000 CTN!
      expect(updated.currentStock).toBe(1010);
      expect(updated.unit).toBe('CTN');

      // Verify movement record
      const movements = await stockMovementService.getMovements({ itemId: TEST_CTN_ITEM_ID });
      expect(movements.length).toBe(1);
      expect(movements[0].quantityDelta).toBe(10);
      expect(movements[0].stockBefore).toBe(1000);
      expect(movements[0].stockAfter).toBe(1010);
      expect(movements[0].unit).toBe('CTN');
    });

    it('deducts exactly 10 CTN from an item with 1,010 CTN balance without multiplying by 100', async () => {
      // First set stock to 1,010
      await inventoryService.updateStock(TEST_CTN_ITEM_ID, {
        mode: 'add',
        adjustmentQuantity: 10,
        delta: 10,
        unit: 'CTN',
      });

      const beforeDeduct = await inventoryService.getItemById(TEST_CTN_ITEM_ID);
      expect(beforeDeduct?.currentStock).toBe(1010);

      // User enters 10 to deduct in the adjustment modal
      const afterDeduct = await inventoryService.updateStock(TEST_CTN_ITEM_ID, {
        mode: 'deduct',
        adjustmentQuantity: 10,
        delta: -10,
        unit: 'CTN',
        reason: 'Stock Deduction (Outward)',
        notes: 'Dispatched 10 cartons',
        userName: 'Admin User',
        userRole: 'admin',
      });

      // Crucial: Must be 1,000 CTN, NOT jumping by 1,000 CTN!
      expect(afterDeduct.currentStock).toBe(1000);
      expect(afterDeduct.unit).toBe('CTN');

      const movements = await stockMovementService.getMovements({ itemId: TEST_CTN_ITEM_ID });
      expect(movements.length).toBe(2);
      expect(movements[0].quantityDelta).toBe(-10);
      expect(movements[0].stockAfter).toBe(1000);
    });

    it('direct quantity calibration sets stock directly without hidden multipliers', async () => {
      const updated = await inventoryService.updateStock(TEST_CTN_ITEM_ID, {
        mode: 'direct',
        targetStock: 1050,
        unit: 'CTN',
        reason: 'Direct Count Calibration',
      });

      expect(updated.currentStock).toBe(1050);
    });
  });

  describe('2. Movement History and Recalculation Without Double-Applying', () => {
    it('recalculates stock accurately when editing a movement without double-applying', async () => {
      // 1. Initial balance 1,000. Add +10 CTN.
      await inventoryService.updateStock(TEST_CTN_ITEM_ID, {
        mode: 'add',
        adjustmentQuantity: 10,
        delta: 10,
        unit: 'CTN',
        reason: 'Original Inward lot',
      });

      let item = await inventoryService.getItemById(TEST_CTN_ITEM_ID);
      expect(item?.currentStock).toBe(1010);

      const movements = await stockMovementService.getMovements({ itemId: TEST_CTN_ITEM_ID });
      expect(movements.length).toBe(1);
      const originalMovement = movements[0];
      expect(originalMovement.quantityDelta).toBe(10);

      // 2. User edits this movement: quantity was actually 15 CTN instead of 10 CTN
      const updateResult = await stockMovementService.updateMovement(originalMovement.id, {
        quantityDelta: 15,
        reason: 'Corrected Inward lot count',
        notes: 'Audit sheet verified 15 cartons arrived',
      });

      // Net difference is (+15) - (+10) = +5
      // Item stock should be 1010 + 5 = 1015 CTN
      expect(updateResult.updatedStock).toBe(1015);
      expect(updateResult.movement.quantityDelta).toBe(15);

      item = await inventoryService.getItemById(TEST_CTN_ITEM_ID);
      expect(item?.currentStock).toBe(1015);

      // 3. User edits this movement again: changes from +15 to +8 CTN
      // Net difference is (+8) - (+15) = -7
      // Item stock should be 1015 - 7 = 1008 CTN (NEVER double-applying previous +10 or +15)
      const secondUpdate = await stockMovementService.updateMovement(originalMovement.id, {
        quantityDelta: 8,
      });

      expect(secondUpdate.updatedStock).toBe(1008);
      item = await inventoryService.getItemById(TEST_CTN_ITEM_ID);
      expect(item?.currentStock).toBe(1008);
    });

    it('recalculates stock when editing a deduction without double-applying', async () => {
      // Start at 1,000 CTN. Deduct 20 CTN.
      await inventoryService.updateStock(TEST_CTN_ITEM_ID, {
        mode: 'deduct',
        adjustmentQuantity: 20,
        delta: -20,
        unit: 'CTN',
      });

      let item = await inventoryService.getItemById(TEST_CTN_ITEM_ID);
      expect(item?.currentStock).toBe(980);

      const movements = await stockMovementService.getMovements({ itemId: TEST_CTN_ITEM_ID });
      const deductMovement = movements[0];
      expect(deductMovement.quantityDelta).toBe(-20);

      // Edit deduction from -20 to -25 (an extra 5 deducted)
      // Net difference: (-25) - (-20) = -5
      // Item stock: 980 - 5 = 975
      const updateResult = await stockMovementService.updateMovement(deductMovement.id, {
        quantityDelta: -25,
      });

      expect(updateResult.updatedStock).toBe(975);
      item = await inventoryService.getItemById(TEST_CTN_ITEM_ID);
      expect(item?.currentStock).toBe(975);
    });

    it('strictly prevents editing a movement if resulting stock would become negative', async () => {
      const movements = await stockMovementService.getMovements({ itemId: TEST_CTN_ITEM_ID });
      // Add a movement with +10
      const mov = await stockMovementService.addMovement({
        itemId: TEST_CTN_ITEM_ID,
        date: new Date().toISOString(),
        type: 'adjustment',
        stockBefore: 1000,
        quantityDelta: 10,
        stockAfter: 1010,
        unit: 'CTN',
        userName: 'Admin',
        userRole: 'admin',
        referenceNumber: 'ADJ-999',
        referenceType: 'Adjustment',
        notes: 'Test',
      });

      // Attempt to change delta to -2000 (stock is 1000, -2000 would result in negative stock)
      await expect(
        stockMovementService.updateMovement(mov.id, {
          quantityDelta: -2000,
        })
      ).rejects.toThrow(/resulting stock would become negative/i);
    });
  });
});
