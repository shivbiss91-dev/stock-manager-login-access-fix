import { createServer } from './server/index.js';
import { DB_PATH } from './server/db.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const server = createServer();

const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`  StockVista SQLite Backend Server`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`  SQLite DB:  ${DB_PATH}`);
  console.log(`  REST APIs:  http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
