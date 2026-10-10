const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const schemaPath = path.join(__dirname, '../../database/schema.sql');
const viewsPath = path.join(__dirname, '../../database/views.sql');
const seedPath = path.join(__dirname, '../../database/seed.sql');

/**
 * Initializes MySQL Database
 */
async function initMySQL() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const databaseName = process.env.DB_NAME || 'library_system';

  console.log(`[MySQL] Connecting to MySQL server at ${host}:${port}...`);

  // Connect without DB first to ensure database exists
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  console.log(`[MySQL] Ensuring database "${databaseName}" exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${databaseName}\`;`);

  console.log('[MySQL] Executing schema.sql (Tables, Constraints, Indexes)...');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await connection.query(schemaSql);

  console.log('[MySQL] Executing views.sql (Views: v_wrong_rack, v_library_stock, v_overdue)...');
  const viewsSql = fs.readFileSync(viewsPath, 'utf8');
  await connection.query(viewsSql);

  console.log('[MySQL] Executing seed.sql (Sample Libraries, Users, Books, Copies, Movements, Notifications)...');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  await connection.query(seedSql);

  await connection.end();
  console.log('[MySQL] Database initialization completed successfully! 🎉');
}

/**
 * Initializes SQLite Database (for standalone mode / local testing when MySQL daemon is unavailable)
 */
function initSQLite() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, '../../database/library.sqlite');
  
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  console.log(`[SQLite] Initializing database at ${dbPath}...`);
  const db = new Database(dbPath);

  // Register user functions
  db.function('radians', (deg) => (deg * Math.PI) / 180);
  db.function('least', (a, b) => Math.min(a, b));
  db.function('datediff', (d1, d2) => {
    if (!d1 || !d2) return 0;
    const diff = new Date(d1).getTime() - new Date(d2).getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  });
  db.function('curdate', () => new Date().toISOString().split('T')[0]);
  db.function('now', () => new Date().toISOString().replace('T', ' ').substring(0, 19));
  db.function('concat', { varargs: true }, (...args) => args.join(''));

  // Convert schema for SQLite
  let schemaSql = fs.readFileSync(schemaPath, 'utf8')
    .replace(/ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;?/gi, ';')
    .replace(/SET FOREIGN_KEY_CHECKS\s*=\s*[01];?/gi, '')
    .replace(/INT AUTO_INCREMENT PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/ENUM\([^)]+\)/gi, 'TEXT')
    .replace(/\bDATETIME\b/gi, 'TEXT')
    .replace(/\bDATE\b/gi, 'TEXT')
    .replace(/DECIMAL\([^)]+\)/gi, 'REAL');

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(schemaSql);
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('[SQLite] Executing views.sql...');
  let viewsSql = fs.readFileSync(viewsPath, 'utf8')
    .replace(/CREATE OR REPLACE VIEW/gi, 'CREATE VIEW IF NOT EXISTS');
  db.exec(viewsSql);

  console.log('[SQLite] Executing seed.sql...');
  let seedSql = fs.readFileSync(seedPath, 'utf8')
    .replace(/SET FOREIGN_KEY_CHECKS\s*=\s*[01];?/gi, '')
    .replace(/TRUNCATE TABLE/gi, 'DELETE FROM')
    .replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, (m, d) => {
      const dt = new Date(); dt.setDate(dt.getDate() - parseInt(d, 10));
      return `'${dt.toISOString().replace('T', ' ').substring(0, 19)}'`;
    })
    .replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+HOUR\s*\)/gi, (m, h) => {
      const dt = new Date(); dt.setHours(dt.getHours() - parseInt(h, 10));
      return `'${dt.toISOString().replace('T', ' ').substring(0, 19)}'`;
    })
    .replace(/DATE_SUB\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, (m, d) => {
      const dt = new Date(); dt.setDate(dt.getDate() - parseInt(d, 10));
      return `'${dt.toISOString().split('T')[0]}'`;
    })
    .replace(/DATE_ADD\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, (m, d) => {
      const dt = new Date(); dt.setDate(dt.getDate() + parseInt(d, 10));
      return `'${dt.toISOString().split('T')[0]}'`;
    })
    .replace(/CURDATE\(\)/gi, `'${new Date().toISOString().split('T')[0]}'`)
    .replace(/NOW\(\)/gi, `'${new Date().toISOString().replace('T', ' ').substring(0, 19)}'`);

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(seedSql);
  db.exec('PRAGMA foreign_keys = ON;');

  db.close();
  console.log('[SQLite] Standalone database initialized successfully! 🎉');
}

async function main() {
  const forceSqlite = process.argv.includes('--sqlite') || process.env.DB_CLIENT === 'sqlite';

  if (forceSqlite) {
    initSQLite();
    return;
  }

  try {
    await initMySQL();
  } catch (err) {
    console.warn(`\n[Warning] Could not connect to MySQL server (${err.message}).`);
    console.warn('[Fallback] Initializing local SQLite database for test/demo mode...\n');
    initSQLite();
  }
}

main().catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
