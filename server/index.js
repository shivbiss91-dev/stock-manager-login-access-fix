import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, DB_PATH } from './db.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const db = initDatabase();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.db': 'application/x-sqlite3',
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB max
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

export function createServer() {
  const server = http.createServer(async (req, res) => {
    // Enable CORS for development
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    try {
      // ----------------------------------------------------
      // API ROUTES
      // ----------------------------------------------------

      // 1. Health & Database Info
      if (pathname === '/api/health' && req.method === 'GET') {
        const stats = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
        return sendJson(res, 200, {
          status: 'ok',
          engine: 'SQLite 3 (Node.js Native Synchronous Storage)',
          dbPath: DB_PATH,
          dbSizeBytes: stats ? stats.size : 0,
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Check if Admin Account Exists
      if (pathname === '/api/auth/admin-exists' && req.method === 'GET') {
        const admin = db.prepare("SELECT id, name, email FROM users WHERE role = 'admin' LIMIT 1").get();
        return sendJson(res, 200, {
          exists: Boolean(admin),
          email: admin ? admin.email : null,
          name: admin ? admin.name : null,
        });
      }

      // 3. First-Time Administrator Setup / Registration
      if (pathname === '/api/auth/setup-admin' && req.method === 'POST') {
        const { name, email, password } = await parseJsonBody(req);
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanName = (name || '').trim();
        const cleanPassword = (password || '').trim();

        if (!cleanEmail || !cleanPassword) {
          return sendError(res, 400, 'Admin Email and Password are required.');
        }

        let existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin' OR email = ?").get(cleanEmail);
        const now = new Date().toISOString();
        const permissions = JSON.stringify([
          'module_dashboard',
          'module_items',
          'module_stock',
          'module_warehouses',
          'module_transfers',
          'module_orders',
          'module_invoices',
        ]);

        if (existingAdmin) {
          // Update credentials for admin
          db.prepare(`
            UPDATE users SET
              name = ?,
              password = ?,
              email = ?,
              last_login = ?
            WHERE id = ?
          `).run(cleanName || existingAdmin.name, cleanPassword, cleanEmail, now, existingAdmin.id);
          existingAdmin = db.prepare('SELECT * FROM users WHERE id = ?').get(existingAdmin.id);
        } else {
          const newId = 'user-admin-root';
          db.prepare(`
            INSERT INTO users (
              id, email, password, name, role, role_title, login_method,
              phone, warehouse_id, warehouse_name, status, permissions, created_at, last_login
            ) VALUES (?, ?, ?, ?, 'admin', 'System Administrator', 'email_password', '+91 98200 00000', 'all', 'All Warehouses', 'active', ?, ?, ?)
          `).run(newId, cleanEmail, cleanPassword, cleanName || 'System Administrator', permissions, now, now);
          existingAdmin = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
        }

        return sendJson(res, 200, {
          token: `sv-admin-jwt-${Date.now()}`,
          user: {
            id: existingAdmin.id,
            name: existingAdmin.name,
            email: existingAdmin.email,
            role: 'admin',
            roleTitle: existingAdmin.role_title,
            warehouseId: existingAdmin.warehouse_id,
            warehouseName: existingAdmin.warehouse_name,
            status: existingAdmin.status,
            permissions: JSON.parse(existingAdmin.permissions || permissions),
          },
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      }

      // 4. Admin Authentication
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const { email, password } = await parseJsonBody(req);
        const cleanEmail = (email || '').trim().toLowerCase();

        let adminUser = db.prepare("SELECT * FROM users WHERE (email = ? OR id = 'user-admin-root') AND role = 'admin'").get(cleanEmail);

        if (!adminUser) {
          // Check if any admin exists
          adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
        }

        if (!adminUser) {
          return sendError(res, 404, 'No administrator account exists. Please complete setup first.');
        }

        // Verify password against stored password in SQLite
        const storedPassword = adminUser.password || 'StockVista@2026';
        if (cleanEmail !== adminUser.email.toLowerCase() || password !== storedPassword) {
          // Also allow default fixed credential if matches
          if (!(cleanEmail === 'admin@stockvista.in' && password === 'StockVista@2026')) {
            return sendError(res, 401, 'Invalid administrator credentials. Access denied.');
          }
        }

        db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), adminUser.id);

        const permissions = adminUser.permissions ? JSON.parse(adminUser.permissions) : [];
        return sendJson(res, 200, {
          token: `sv-admin-jwt-${Date.now()}`,
          user: {
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
            role: 'admin',
            roleTitle: adminUser.role_title,
            warehouseId: adminUser.warehouse_id,
            warehouseName: adminUser.warehouse_name,
            status: adminUser.status,
            permissions,
          },
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      }

      // 3. Staff Google One-Click Login
      if (pathname === '/api/auth/google' && req.method === 'POST') {
        const { email, name } = await parseJsonBody(req);
        const cleanEmail = (email || '').trim().toLowerCase();

        if (!cleanEmail || !cleanEmail.includes('@')) {
          return sendError(res, 400, 'Valid Google/Gmail address is required.');
        }

        if (cleanEmail === 'admin@stockvista.in') {
          return sendError(res, 403, 'Administrator accounts must sign in using the Admin tab with password.');
        }

        let staffUser = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

        if (!staffUser) {
          // Auto-register verified Google staff user into users table
          const newId = `user-staff-${Date.now()}`;
          const displayName = (name || '').trim() || cleanEmail.split('@')[0].replace('.', ' ');
          const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
          const defaultPermissions = JSON.stringify([
            'module_dashboard',
            'module_items',
            'module_stock',
            'module_warehouses',
            'module_transfers',
            'module_orders',
            'module_invoices',
          ]);

          db.prepare(`
            INSERT INTO users (
              id, email, password, name, role, role_title, login_method,
              phone, warehouse_id, warehouse_name, status, permissions, created_at, last_login
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            newId,
            cleanEmail,
            '',
            formattedName,
            'staff',
            'Billing Staff',
            'google',
            '+91 98200 12345',
            'wh-001',
            'Bhiwandi Central Hub',
            'active',
            defaultPermissions,
            new Date().toISOString(),
            new Date().toISOString()
          );

          staffUser = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
        } else {
          if (staffUser.status === 'deactivated' || staffUser.status === 'suspended') {
            return sendError(res, 403, 'Your staff account has been deactivated by the administrator.');
          }
          db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), staffUser.id);
        }

        const permissions = staffUser.permissions ? JSON.parse(staffUser.permissions) : [];
        return sendJson(res, 200, {
          token: `sv-google-jwt-${Date.now()}`,
          user: {
            id: staffUser.id,
            name: staffUser.name,
            email: staffUser.email,
            role: staffUser.role,
            roleTitle: staffUser.role_title,
            warehouseId: staffUser.warehouse_id,
            warehouseName: staffUser.warehouse_name,
            status: staffUser.status,
            permissions,
          },
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      }

      // 4. User Management: GET all users
      if (pathname === '/api/users' && req.method === 'GET') {
        const users = db.prepare(`
          SELECT id, email, name, role, role_title, login_method, phone,
                 warehouse_id, warehouse_name, status, permissions, created_at, last_login
          FROM users
          ORDER BY created_at DESC
        `).all();

        const formatted = users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          roleTitle: u.role_title,
          loginMethod: u.login_method,
          phone: u.phone,
          warehouseId: u.warehouse_id,
          warehouseName: u.warehouse_name,
          status: u.status,
          permissions: u.permissions ? JSON.parse(u.permissions) : [],
          createdAt: u.created_at,
          lastLogin: u.last_login,
        }));

        return sendJson(res, 200, formatted);
      }

      // 5. User Management: POST create user
      if (pathname === '/api/users' && req.method === 'POST') {
        const data = await parseJsonBody(req);
        const cleanEmail = (data.email || '').trim().toLowerCase();

        if (!cleanEmail || !data.name) {
          return sendError(res, 400, 'Name and email are required.');
        }

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
        if (existing) {
          return sendError(res, 409, 'A user with this email address already exists.');
        }

        const id = `user-${Date.now()}`;
        const permissions = JSON.stringify(data.permissions || [
          'module_dashboard',
          'module_items',
          'module_stock',
          'module_warehouses',
          'module_transfers',
          'module_orders',
          'module_invoices',
        ]);

        db.prepare(`
          INSERT INTO users (
            id, email, password, name, role, role_title, login_method,
            phone, warehouse_id, warehouse_name, status, permissions, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          cleanEmail,
          data.password || '',
          data.name.trim(),
          data.role || 'staff',
          data.roleTitle || (data.role === 'manager' ? 'Operations Manager' : 'Billing Staff'),
          data.loginMethod || 'google',
          data.phone || '',
          data.warehouseId || 'wh-001',
          data.warehouseName || 'Bhiwandi Central Hub',
          'active',
          permissions,
          new Date().toISOString()
        );

        const created = db.prepare('SELECT id, email, name, role, role_title, status, permissions, created_at FROM users WHERE id = ?').get(id);
        return sendJson(res, 201, {
          ...created,
          permissions: JSON.parse(created.permissions || '[]'),
        });
      }

      // 6. User Management: DELETE user (Admin Control)
      if (pathname.startsWith('/api/users/') && req.method === 'DELETE') {
        const userId = pathname.split('/')[3];
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!user) {
          return sendError(res, 404, 'User not found.');
        }

        if (user.email === 'admin@stockvista.in' || user.id === 'user-admin-root' || user.role === 'admin') {
          return sendError(res, 403, 'Root Administrator account cannot be deleted.');
        }

        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        return sendJson(res, 200, { success: true, message: `User ${user.name} (${user.email}) permanently deleted.` });
      }

      // 7. User Management: PATCH update user status / role / permissions
      if (pathname.startsWith('/api/users/') && req.method === 'PATCH') {
        const userId = pathname.split('/')[3];
        const updates = await parseJsonBody(req);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!user) {
          return sendError(res, 404, 'User not found.');
        }

        if (updates.status) {
          db.prepare('UPDATE users SET status = ? WHERE id = ?').run(updates.status, userId);
        }
        if (updates.role) {
          db.prepare('UPDATE users SET role = ? WHERE id = ?').run(updates.role, userId);
        }
        if (updates.permissions) {
          db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(JSON.stringify(updates.permissions), userId);
        }

        const updated = db.prepare('SELECT id, email, name, role, status, permissions FROM users WHERE id = ?').get(userId);
        return sendJson(res, 200, {
          ...updated,
          permissions: JSON.parse(updated.permissions || '[]'),
        });
      }

      // 8. Inventory Items: GET all items
      if (pathname === '/api/items' && req.method === 'GET') {
        const items = db.prepare('SELECT * FROM items ORDER BY name ASC').all();
        const formatted = items.map((i) => ({
          id: i.id,
          name: i.name,
          sku: i.sku,
          materialCategory: i.material_category,
          materialSubtype: i.material_subtype,
          sellingPrice: i.selling_price,
          costPrice: i.cost_price,
          currentStock: i.current_stock,
          unit: i.unit,
          reorderLevel: i.reorder_level,
          reorderQuantity: i.reorder_quantity,
          warehouseId: i.warehouse_id,
          warehouseName: i.warehouse_name,
          rackLocation: i.rack_location,
          images: i.images ? JSON.parse(i.images) : [],
          hsnCode: i.hsn_code,
          gstRate: i.gst_rate,
          description: i.description,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        }));
        return sendJson(res, 200, formatted);
      }

      // 9. Inventory Items: POST create item
      if (pathname === '/api/items' && req.method === 'POST') {
        const item = await parseJsonBody(req);
        const id = item.id || `item-${Date.now()}`;
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO items (
            id, name, sku, material_category, material_subtype,
            selling_price, cost_price, current_stock, unit,
            reorder_level, reorder_quantity, warehouse_id, warehouse_name,
            rack_location, images, hsn_code, gst_rate, description,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          item.name,
          item.sku,
          item.materialCategory,
          item.materialSubtype || '',
          item.sellingPrice || 0,
          item.costPrice || 0,
          item.currentStock || 0,
          item.unit || 'PCS',
          item.reorderLevel || 0,
          item.reorderQuantity || 0,
          item.warehouseId || '',
          item.warehouseName || 'Unassigned',
          item.rackLocation || '',
          JSON.stringify(item.images || []),
          item.hsnCode || '',
          item.gstRate || 0,
          item.description || '',
          now,
          now
        );

        return sendJson(res, 201, { id, ...item });
      }

      // 10. Inventory Items: PUT update item
      if (pathname.startsWith('/api/items/') && req.method === 'PUT') {
        const itemId = pathname.split('/')[3];
        const item = await parseJsonBody(req);
        const now = new Date().toISOString();

        db.prepare(`
          UPDATE items SET
            name = ?, material_category = ?, material_subtype = ?,
            selling_price = ?, cost_price = ?, unit = ?,
            reorder_level = ?, reorder_quantity = ?, warehouse_id = ?, warehouse_name = ?,
            rack_location = ?, images = ?, hsn_code = ?, gst_rate = ?, description = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          item.name,
          item.materialCategory,
          item.materialSubtype || '',
          item.sellingPrice || 0,
          item.costPrice || 0,
          item.unit || 'PCS',
          item.reorderLevel || 0,
          item.reorderQuantity || 0,
          item.warehouseId || '',
          item.warehouseName || 'Unassigned',
          item.rackLocation || '',
          JSON.stringify(item.images || []),
          item.hsnCode || '',
          item.gstRate || 0,
          item.description || '',
          now,
          itemId
        );

        return sendJson(res, 200, { id: itemId, ...item, updatedAt: now });
      }

      // 11. Inventory Items: Stock Adjustment (1:1 Manual Addition / Deduction / Calibration)
      if (pathname.endsWith('/stock') && req.method === 'POST') {
        const parts = pathname.split('/');
        const itemId = parts[3];
        const body = await parseJsonBody(req);
        const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);

        if (!item) {
          return sendError(res, 404, 'Item not found.');
        }

        const delta = parseInt(body.delta, 10) || 0;
        const previousStock = item.current_stock;
        let resultingStock = previousStock + delta;

        if (body.mode === 'direct' && typeof body.targetStock === 'number') {
          resultingStock = body.targetStock;
        }

        if (resultingStock < 0) {
          return sendError(res, 400, 'Negative stock balance is strictly forbidden.');
        }

        // Update item stock
        db.prepare('UPDATE items SET current_stock = ?, updated_at = ? WHERE id = ?').run(
          resultingStock,
          new Date().toISOString(),
          itemId
        );

        // Record double-entry stock movement
        const movementId = `mov-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO stock_movements (
            id, item_id, item_name, sku, movement_type, quantity, delta,
            previous_stock, resulting_stock, reason, notes, date, timestamp, user_name, user_role
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          movementId,
          itemId,
          item.name,
          item.sku,
          body.mode || (delta > 0 ? 'in' : 'out'),
          Math.abs(body.adjustmentQuantity || delta),
          delta,
          previousStock,
          resultingStock,
          body.reason || 'Manual Calibration',
          body.notes || '',
          body.date || now.slice(0, 10),
          now,
          body.userName || 'Authorized Staff',
          body.userRole || 'Staff'
        );

        return sendJson(res, 200, {
          success: true,
          itemId,
          previousStock,
          resultingStock,
          delta,
        });
      }

      // 12. Backup: Database Details & Stats
      if (pathname === '/api/backup/info' && req.method === 'GET') {
        const stats = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
        const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get()?.cnt || 0;
        const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM items').get()?.cnt || 0;
        const movCount = db.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get()?.cnt || 0;
        const whCount = db.prepare('SELECT COUNT(*) as cnt FROM warehouses').get()?.cnt || 0;

        return sendJson(res, 200, {
          engine: 'SQLite 3 (Node.js Native Synchronous Storage)',
          dbPath: DB_PATH,
          fileSizeBytes: stats ? stats.size : 0,
          fileSizeFormatted: stats ? `${(stats.size / 1024).toFixed(2)} KB` : '0 KB',
          lastModified: stats ? stats.mtime.toISOString() : null,
          counts: {
            users: userCount,
            items: itemCount,
            stockMovements: movCount,
            warehouses: whCount,
          },
        });
      }

      // 13. Backup: Direct SQLite File Download (.db)
      if (pathname === '/api/backup/download-db' && req.method === 'GET') {
        if (!fs.existsSync(DB_PATH)) {
          return sendError(res, 404, 'Database file not found on server.');
        }

        const stats = fs.statSync(DB_PATH);
        res.writeHead(200, {
          'Content-Type': 'application/x-sqlite3',
          'Content-Length': stats.size,
          'Content-Disposition': `attachment; filename="stockvista_backup_${new Date().toISOString().slice(0, 10)}.db"`,
        });

        const stream = fs.createReadStream(DB_PATH);
        stream.pipe(res);
        return;
      }

      // 14. Backup: JSON Snapshot Download
      if (pathname === '/api/backup/download-json' && req.method === 'GET') {
        const users = db.prepare('SELECT id, email, name, role, role_title, login_method, status, permissions FROM users').all();
        const items = db.prepare('SELECT * FROM items').all();
        const movements = db.prepare('SELECT * FROM stock_movements').all();
        const warehouses = db.prepare('SELECT * FROM warehouses').all();

        const snapshot = {
          metadata: {
            engine: 'SQLite 3',
            exportedAt: new Date().toISOString(),
            usersCount: users.length,
            itemsCount: items.length,
            movementsCount: movements.length,
            warehousesCount: warehouses.length,
          },
          users,
          items,
          movements,
          warehouses,
        };

        const jsonStr = JSON.stringify(snapshot, null, 2);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="stockvista_snapshot_${new Date().toISOString().slice(0, 10)}.json"`,
        });
        res.end(jsonStr);
        return;
      }

      // ----------------------------------------------------
      // STATIC FILE SERVING (React SPA)
      // ----------------------------------------------------
      if (req.method === 'GET') {
        let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

        // Security check: prevent directory traversal
        if (!filePath.startsWith(DIST_DIR)) {
          return sendError(res, 403, 'Forbidden');
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        // SPA fallback: serve index.html
        const indexPath = path.join(DIST_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(indexPath).pipe(res);
          return;
        }

        // In dev mode when dist hasn't been built yet
        return sendJson(res, 200, {
          message: 'StockVista SQLite Backend Server is running.',
          endpoints: [
            '/api/health',
            '/api/auth/login',
            '/api/auth/google',
            '/api/users',
            '/api/items',
            '/api/backup/info',
            '/api/backup/download-db',
            '/api/backup/download-json',
          ],
        });
      }

      return sendError(res, 404, 'Endpoint not found');
    } catch (err) {
      console.error('Server error:', err);
      return sendError(res, 500, err instanceof Error ? err.message : 'Internal Server Error');
    }
  });

  return server;
}

if (process.argv[1] && process.argv[1].endsWith('server.js') || process.argv[1] && process.argv[1].endsWith('index.js')) {
  const server = createServer();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`  StockVista SQLite Backend Server`);
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log(`  SQLite DB:  ${DB_PATH}`);
    console.log(`====================================================`);
  });
}
