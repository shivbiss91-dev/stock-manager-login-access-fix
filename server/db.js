import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_PATH = path.join(DATA_DIR, 'stockvista.db');

export function initDatabase(dbPath = DB_PATH) {
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode and foreign keys for high performance and integrity
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Separate table for users & admin credentials to prevent any mix-up with products
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      role_title TEXT,
      login_method TEXT NOT NULL DEFAULT 'google',
      phone TEXT,
      warehouse_id TEXT DEFAULT 'all',
      warehouse_name TEXT DEFAULT 'All Warehouses',
      status TEXT NOT NULL DEFAULT 'active',
      permissions TEXT,
      avatar TEXT,
      created_at TEXT NOT NULL,
      last_login TEXT
    );
  `);

  // 2. Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      material_category TEXT NOT NULL,
      material_subtype TEXT,
      selling_price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      current_stock INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'PCS',
      reorder_level INTEGER NOT NULL DEFAULT 0,
      reorder_quantity INTEGER NOT NULL DEFAULT 0,
      warehouse_id TEXT,
      warehouse_name TEXT,
      rack_location TEXT,
      images TEXT,
      hsn_code TEXT,
      gst_rate REAL NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 3. Stock Movement Ledger
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      resulting_stock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      date TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
  `);

  // 4. Warehouses
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      address TEXT,
      city TEXT,
      state TEXT,
      capacity INTEGER DEFAULT 10000
    );
  `);

  // 5. Parties (Customers & Suppliers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'customer' or 'supplier'
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      gstin TEXT,
      address TEXT,
      city TEXT,
      state TEXT
    );
  `);

  // Seed default Admin if missing
  const adminCheck = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@stockvista.in');
  if (!adminCheck) {
    const insertAdmin = db.prepare(`
      INSERT INTO users (
        id, email, password, name, role, role_title, login_method,
        phone, warehouse_id, warehouse_name, status, permissions, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);
    insertAdmin.run(
      'user-admin-root',
      'admin@stockvista.in',
      'StockVista@2026',
      'StockVista Administrator',
      'admin',
      'System Administrator',
      'email_password',
      '+91 98200 00000',
      'all',
      'All Warehouses',
      'active',
      JSON.stringify([
        'module_dashboard',
        'module_items',
        'module_stock',
        'module_warehouses',
        'module_transfers',
        'module_orders',
        'module_invoices',
      ]),
      new Date().toISOString()
    );
  }

  // Seed default Staff if missing
  const staffCheck = db.prepare('SELECT id FROM users WHERE email = ?').get('rahul.deshmukh@gmail.com');
  if (!staffCheck) {
    const insertStaff = db.prepare(`
      INSERT INTO users (
        id, email, password, name, role, role_title, login_method,
        phone, warehouse_id, warehouse_name, status, permissions, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);
    insertStaff.run(
      'user-staff-rahul',
      'rahul.deshmukh@gmail.com',
      '',
      'Rahul Deshmukh',
      'staff',
      'Billing Staff',
      'google',
      '+91 98200 12345',
      'wh-001',
      'Bhiwandi Central Hub',
      'active',
      JSON.stringify([
        'module_dashboard',
        'module_items',
        'module_stock',
        'module_warehouses',
        'module_transfers',
        'module_orders',
        'module_invoices',
      ]),
      new Date().toISOString()
    );
  }

  // Seed default starter catalog items if items table is empty
  const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM items').get();
  if (itemCount && itemCount.cnt === 0) {
    const starterItems = [
      {
        id: 'starter-card-holder',
        name: 'Card Holder',
        sku: 'CH-001',
        material_category: 'card_holder',
        material_subtype: 'Card Holders & Sleeves',
        selling_price: 15.0,
        cost_price: 8.5,
        current_stock: 0,
        unit: 'PCS',
        reorder_level: 50,
        reorder_quantity: 200,
        warehouse_id: 'wh-001',
        warehouse_name: 'Bhiwandi Central Hub',
        rack_location: 'A-12',
        images: JSON.stringify(['/products/card-holder.svg']),
        hsn_code: '3926',
        gst_rate: 18,
        description: 'Durable transparent ID card holder sleeve with top lanyard attachment slot.',
      },
      {
        id: 'starter-lanyard',
        name: 'Lanyard',
        sku: 'LAN-001',
        material_category: 'lanyard',
        material_subtype: 'Lanyards & Straps',
        selling_price: 25.0,
        cost_price: 12.0,
        current_stock: 0,
        unit: 'PCS',
        reorder_level: 100,
        reorder_quantity: 500,
        warehouse_id: 'wh-001',
        warehouse_name: 'Bhiwandi Central Hub',
        rack_location: 'B-04',
        images: JSON.stringify(['/products/lanyard.svg']),
        hsn_code: '6307',
        gst_rate: 12,
        description: 'Premium woven neck strap lanyard equipped with metal attachment clasp.',
      },
      {
        id: 'starter-hook',
        name: 'Hook',
        sku: 'HK-001',
        material_category: 'hook',
        material_subtype: 'Metal & Plastic Hooks',
        selling_price: 8.0,
        cost_price: 3.5,
        current_stock: 0,
        unit: 'PCS',
        reorder_level: 200,
        reorder_quantity: 1000,
        warehouse_id: 'wh-002',
        warehouse_name: 'Panvel Logistics Hub',
        rack_location: 'C-01',
        images: JSON.stringify(['/products/hook.svg']),
        hsn_code: '8308',
        gst_rate: 18,
        description: 'Heavy-duty swivel snap clip hook for badge lanyards and keychains.',
      },
      {
        id: 'starter-button-bag',
        name: 'Button Bag',
        sku: 'BB-001',
        material_category: 'button_bag',
        material_subtype: 'Packaging & Envelopes',
        selling_price: 5.0,
        cost_price: 2.0,
        current_stock: 0,
        unit: 'PCS',
        reorder_level: 500,
        reorder_quantity: 2000,
        warehouse_id: 'wh-001',
        warehouse_name: 'Bhiwandi Central Hub',
        rack_location: 'D-08',
        images: JSON.stringify(['/products/button-bag.svg']),
        hsn_code: '3923',
        gst_rate: 18,
        description: 'Clear PVC envelope pouch with secure press-button snap button closure.',
      },
    ];

    const insertItem = db.prepare(`
      INSERT INTO items (
        id, name, sku, material_category, material_subtype,
        selling_price, cost_price, current_stock, unit,
        reorder_level, reorder_quantity, warehouse_id, warehouse_name,
        rack_location, images, hsn_code, gst_rate, description,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    const now = new Date().toISOString();
    for (const item of starterItems) {
      insertItem.run(
        item.id,
        item.name,
        item.sku,
        item.material_category,
        item.material_subtype,
        item.selling_price,
        item.cost_price,
        item.current_stock,
        item.unit,
        item.reorder_level,
        item.reorder_quantity,
        item.warehouse_id,
        item.warehouse_name,
        item.rack_location,
        item.images,
        item.hsn_code,
        item.gst_rate,
        item.description,
        now,
        now
      );
    }
  }

  // Seed default warehouses if empty
  const whCount = db.prepare('SELECT COUNT(*) as cnt FROM warehouses').get();
  if (whCount && whCount.cnt === 0) {
    const insertWh = db.prepare('INSERT INTO warehouses (id, name, code, address, city, state, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertWh.run('wh-001', 'Bhiwandi Central Hub', 'BHW-01', 'Survey 44, Mankoli Naka, Bhiwandi', 'Bhiwandi', 'Maharashtra', 25000);
    insertWh.run('wh-002', 'Panvel Logistics Hub', 'PNV-02', 'Plot 18, MIDC Taloja, Panvel', 'Navi Mumbai', 'Maharashtra', 15000);
    insertWh.run('wh-003', 'Nagpur Central Depot', 'NGP-03', 'MIHAN SEZ Logistics Park', 'Nagpur', 'Maharashtra', 20000);
    insertWh.run('wh-004', 'Pune Chakan Depot', 'PUN-04', 'Phase II Chakan Industrial Area', 'Pune', 'Maharashtra', 18000);
  }

  return db;
}
