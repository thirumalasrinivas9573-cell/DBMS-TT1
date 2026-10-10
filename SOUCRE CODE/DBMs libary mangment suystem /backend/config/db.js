const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;
let isSqlite = process.env.DB_CLIENT === 'sqlite';
let sqliteInstance = null;

if (isSqlite) {
  const Database = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');

  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../database/library.sqlite');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqliteDb = new Database(dbPath);

  // Register MySQL-compatible user-defined functions
  sqliteDb.function('radians', (deg) => (deg * Math.PI) / 180);
  sqliteDb.function('least', (a, b) => Math.min(a, b));
  sqliteDb.function('datediff', (d1, d2) => {
    if (!d1 || !d2) return 0;
    const diff = new Date(d1).getTime() - new Date(d2).getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  });
  sqliteDb.function('curdate', () => new Date().toISOString().split('T')[0]);
  sqliteDb.function('now', () => new Date().toISOString().replace('T', ' ').substring(0, 19));
  sqliteDb.function('concat', { varargs: true }, (...args) => args.join(''));

  sqliteInstance = sqliteDb;

  // Build a mysql2-compatible adapter
  pool = {
    async query(sql, params = []) {
      const cleanSql = sql.replace(/\s+FOR\s+UPDATE\b/gi, '');
      const trimmed = cleanSql.trim();
      const isSelect = /^SELECT|^WITH|^PRAGMA|^SHOW/i.test(trimmed);

      try {
        const stmt = sqliteDb.prepare(cleanSql);
        if (isSelect) {
          const rows = stmt.all(...params);
          return [rows, []];
        } else {
          const info = stmt.run(...params);
          return [{
            insertId: Number(info.lastInsertRowid),
            affectedRows: info.changes,
            changedRows: info.changes
          }, []];
        }
      } catch (err) {
        throw err;
      }
    },

    async getConnection() {
      let inTx = false;
      return {
        async beginTransaction() {
          sqliteDb.prepare('BEGIN TRANSACTION').run();
          inTx = true;
        },
        async query(sql, params = []) {
          const cleanSql = sql.replace(/\s+FOR\s+UPDATE\b/gi, '');
          const trimmed = cleanSql.trim();
          const isSelect = /^SELECT|^WITH|^PRAGMA|^SHOW/i.test(trimmed);
          const stmt = sqliteDb.prepare(cleanSql);
          if (isSelect) {
            const rows = stmt.all(...params);
            return [rows, []];
          } else {
            const info = stmt.run(...params);
            return [{
              insertId: Number(info.lastInsertRowid),
              affectedRows: info.changes,
              changedRows: info.changes
            }, []];
          }
        },
        async commit() {
          if (inTx) {
            sqliteDb.prepare('COMMIT').run();
            inTx = false;
          }
        },
        async rollback() {
          if (inTx) {
            try { sqliteDb.prepare('ROLLBACK').run(); } catch (_) {}
            inTx = false;
          }
        },
        release() {
          // No-op for SQLite
        }
      };
    },

    getRawSqlite() {
      return sqliteDb;
    }
  };
} else {
  // MySQL connection pool using mysql2/promise
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'library_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true
  });
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  getConnection: () => pool.getConnection(),
  isSqlite: () => isSqlite,
  getRawSqlite: () => sqliteInstance
};
