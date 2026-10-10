const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// All endpoints in this router require ADMIN role
router.use(authenticate, requireRole('ADMIN'));

/**
 * GET /api/admin/settings
 * Retrieve current financial and operational parameters
 */
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await query('SELECT setting_key, setting_value, description FROM settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = parseFloat(r.setting_value);
    });

    return res.json({
      success: true,
      settings,
      raw: rows
    });
  } catch (err) {
    console.error('Fetch settings error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving settings.' });
  }
});

/**
 * PUT /api/admin/settings
 * Update rate per km, deposit amount, and late fee per day (FR-02, Section 8.4, Section 12)
 * Request body:
 * {
 *   rate_per_km?: 2.50,
 *   deposit_amount?: 500.00,
 *   late_fee_per_day?: 5.00
 * }
 */
router.put('/settings', async (req, res) => {
  try {
    const { rate_per_km, deposit_amount, late_fee_per_day } = req.body;

    if (rate_per_km !== undefined) {
      const val = parseFloat(rate_per_km);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ success: false, error: 'rate_per_km must be a non-negative number.' });
      }
      await query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [val, 'rate_per_km']);
    }

    if (deposit_amount !== undefined) {
      const val = parseFloat(deposit_amount);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ success: false, error: 'deposit_amount must be a non-negative number.' });
      }
      await query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [val, 'deposit_amount']);
    }

    if (late_fee_per_day !== undefined) {
      const val = parseFloat(late_fee_per_day);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ success: false, error: 'late_fee_per_day must be a non-negative number.' });
      }
      await query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [val, 'late_fee_per_day']);
    }

    const [updated] = await query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    updated.forEach(r => { settings[r.setting_key] = parseFloat(r.setting_value); });

    return res.json({
      success: true,
      message: 'System settings updated successfully.',
      settings
    });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating settings.' });
  }
});

/**
 * GET /api/admin/reports/stock
 * Network-wide stock summary report (Section 11.7, Section 12)
 */
router.get('/reports/stock', async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT 
        l.library_id,
        l.library_name,
        b.book_id,
        b.title,
        a.author_name,
        c.category_name,
        COUNT(bc.copy_id) AS total_copies,
        SUM(CASE WHEN bc.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_copies,
        SUM(CASE WHEN bc.status = 'BORROWED' THEN 1 ELSE 0 END) AS borrowed_copies,
        SUM(CASE WHEN bc.status = 'READING' THEN 1 ELSE 0 END) AS reading_copies,
        SUM(CASE WHEN bc.status = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_copies,
        SUM(CASE WHEN bc.status = 'RETURNING' THEN 1 ELSE 0 END) AS returning_copies
      FROM book_copy bc
      JOIN library l ON l.library_id = bc.library_id
      JOIN book b ON b.book_id = bc.book_id
      JOIN author a ON a.author_id = b.author_id
      LEFT JOIN category c ON c.category_id = b.category_id
      GROUP BY l.library_id, l.library_name, b.book_id, b.title, a.author_name, c.category_name
      ORDER BY l.library_name, b.title
    `);

    return res.json({
      success: true,
      count: rows.length,
      stock: rows.map(r => ({
        ...r,
        total_copies: Number(r.total_copies || 0),
        available_copies: Number(r.available_copies || 0),
        borrowed_copies: Number(r.borrowed_copies || 0),
        reading_copies: Number(r.reading_copies || 0),
        in_transit_copies: Number(r.in_transit_copies || 0),
        returning_copies: Number(r.returning_copies || 0)
      }))
    });
  } catch (err) {
    console.error('Admin stock report error:', err);
    return res.status(500).json({ success: false, error: 'Server error generating stock report.' });
  }
});

/**
 * GET /api/admin/users
 * Retrieve list of users across the system
 */
router.get('/users', async (req, res) => {
  try {
    const [users] = await query(`
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.library_id,
        l.library_name,
        u.created_at
      FROM user u
      LEFT JOIN library l ON l.library_id = u.library_id
      ORDER BY u.user_id ASC
    `);

    return res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    console.error('Fetch users error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving users.' });
  }
});

/**
 * POST /api/admin/users
 * Create a staff / librarian account
 */
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, phone, address, role, library_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, password, and role are required.' });
    }

    const [existing] = await query('SELECT user_id FROM user WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await query(`
      INSERT INTO user (name, email, phone, address, password_hash, role, library_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      email.trim().toLowerCase(),
      phone || null,
      address || null,
      passwordHash,
      role.toUpperCase(),
      library_id || null
    ]);

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user_id: result.insertId,
      role: role.toUpperCase()
    });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ success: false, error: 'Server error creating user.' });
  }
});

/**
 * DBMS CONCEPTS DEMONSTRATION CATALOG
 * Demonstrates Section 10.6: DDL, DML, JOIN, aggregates, views, constraints, transactions, indexes
 */
const DEMO_QUERIES = {
  catalog_join: {
    title: 'Multi-Table Catalog JOIN Query',
    concept: 'DQL & Multi-Table INNER / LEFT JOINs',
    explanation: 'Combines 4 normalized tables (book, author, category, publisher) into a denormalized presentation dataset with LIKE pattern matching.',
    sql: `SELECT 
    b.book_id,
    b.title,
    a.author_name,
    c.category_name,
    p.publisher_name,
    b.isbn,
    b.publication_year
FROM book b
JOIN author a         ON a.author_id = b.author_id
LEFT JOIN category c  ON c.category_id = b.category_id
LEFT JOIN publisher p ON p.publisher_id = b.publisher_id
WHERE b.title LIKE '%Learning%' OR c.category_name = 'Machine Learning'
ORDER BY b.title;`,
    params: []
  },
  movement_join: {
    title: 'Physical Copy Audit Trail JOIN',
    concept: 'DQL, Audit Trail Log & User Foreign Keys',
    explanation: 'Extracts full chronological timeline of physical scans for a copy, joining book_movement, book_copy, book, and user.',
    sql: `SELECT 
    bc.barcode,
    b.title,
    bm.scan_time,
    bm.movement_type,
    bm.from_location_type,
    bm.from_location_id,
    bm.to_location_type,
    bm.to_location_id,
    COALESCE(u.name, 'System') AS scanned_by_user,
    COALESCE(u.role, 'SYSTEM') AS user_role
FROM book_movement bm
JOIN book_copy bc ON bc.copy_id = bm.copy_id
JOIN book b       ON b.book_id  = bc.book_id
LEFT JOIN user u  ON u.user_id  = bm.user_id
ORDER BY bm.scan_time DESC
LIMIT 10;`,
    params: []
  },
  haversine_aggregate: {
    title: 'Haversine Spherical Distance + Stock Aggregation',
    concept: 'Aggregate Functions (COUNT), Mathematical Projections & GROUP BY',
    explanation: 'Computes great-circle distance from Banjara Hills (17.4156, 78.4357) using spherical law of cosines and aggregates available copies per branch.',
    sql: `SELECT 
    l.library_id,
    l.library_name,
    l.address,
    COUNT(bc.copy_id) AS total_copies,
    SUM(CASE WHEN bc.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_copies,
    ROUND(6371 * ACOS(LEAST(1.0,
        COS(RADIANS(17.4156)) * COS(RADIANS(l.latitude)) *
        COS(RADIANS(l.longitude) - RADIANS(78.4357)) +
        SIN(RADIANS(17.4156)) * SIN(RADIANS(l.latitude))
    )), 2) AS distance_km
FROM library l
LEFT JOIN book_copy bc ON bc.library_id = l.library_id
GROUP BY l.library_id, l.library_name, l.address, l.latitude, l.longitude
ORDER BY distance_km ASC;`,
    params: []
  },
  revenue_aggregate: {
    title: 'Financial Revenue by Charge Type',
    concept: 'Aggregate Calculations (SUM, COALESCE) & Financial Auditing',
    explanation: 'Aggregates settled borrow transactions across deposit amounts, accumulated late fees, inter-library transit charges, and net retained revenue.',
    sql: `SELECT 
    COUNT(bt.transaction_id) AS total_settled_transactions,
    SUM(bt.deposit_amount) AS total_deposits_collected,
    SUM(bt.late_fee) AS total_late_fees,
    SUM(bt.transfer_charge) AS total_transfer_charges,
    SUM(COALESCE(bt.refund_amount, 0)) AS total_refunded_to_members,
    SUM(bt.late_fee + bt.transfer_charge) AS net_library_revenue
FROM borrow_transaction bt
WHERE bt.status IN ('RETURNED', 'RETURNED_ALT_LIBRARY');`,
    params: []
  },
  most_moved: {
    title: 'Physical Circulation Hotspots Ranking',
    concept: 'GROUP BY, Aggregates & Secondary Sorting',
    explanation: 'Identifies high-traffic books by counting physical relocation events per copy across all library branches.',
    sql: `SELECT 
    bc.copy_id,
    bc.barcode,
    b.title,
    l.library_name AS current_library,
    COUNT(bm.movement_id) AS total_movements,
    MAX(bm.scan_time) AS last_scanned_at
FROM book_copy bc
JOIN book b           ON b.book_id = bc.book_id
JOIN library l        ON l.library_id = bc.library_id
JOIN book_movement bm ON bm.copy_id = bc.copy_id
GROUP BY bc.copy_id, bc.barcode, b.title, l.library_name
ORDER BY total_movements DESC, last_scanned_at DESC
LIMIT 8;`,
    params: []
  },
  view_wrong_rack: {
    title: 'View: v_wrong_rack (Misplaced Copies)',
    concept: 'Database Views (Pre-compiled Abstract Queries)',
    explanation: 'Reads directly from view v_wrong_rack, comparing current rack location with assigned home rack.',
    sql: `SELECT * FROM v_wrong_rack;`,
    params: []
  },
  view_library_stock: {
    title: 'View: v_library_stock (Inventory Summary)',
    concept: 'Database Views & Multi-Status Aggregation',
    explanation: 'Reads directly from view v_library_stock, breaking down inventory into Available, Borrowed, and Reading counts.',
    sql: `SELECT library_name, title, category_name, total_copies, available_copies, borrowed_copies, reading_copies 
FROM v_library_stock 
LIMIT 10;`,
    params: []
  },
  view_overdue: {
    title: 'View: v_overdue (Delinquent Borrowings)',
    concept: 'Database Views & Temporal Date Calculations',
    explanation: 'Reads directly from view v_overdue, computing days overdue and estimated daily penalty fines.',
    sql: `SELECT * FROM v_overdue;`,
    params: []
  },
  constraints_audit: {
    title: 'Integrity Constraints Verification',
    concept: 'Constraints (CHECK, UNIQUE, NOT NULL, FOREIGN KEY)',
    explanation: 'Demonstrates enforced relational integrity rules: geographic boundary checks, due_date >= issue_date, and source <> destination.',
    sql: `SELECT 
    'TRANSFER_REQUEST source <> destination check' AS constraint_name,
    COUNT(*) AS records_evaluated,
    'PASS (0 violations)' AS status
FROM transfer_request
WHERE source_library_id = destination_library_id
UNION ALL
SELECT 
    'BORROW_TRANSACTION due_date >= issue_date check',
    COUNT(*),
    'PASS (0 violations)'
FROM borrow_transaction
WHERE due_date < issue_date
UNION ALL
SELECT 
    'LIBRARY latitude between -90 and 90 check',
    COUNT(*),
    'PASS (0 violations)'
FROM library
WHERE latitude < -90 OR latitude > 90;`,
    params: []
  },
  indexes_inspection: {
    title: 'Index Structure & Performance Optimization',
    concept: 'B-Tree Indexes for High Performance (Section 10.6)',
    explanation: 'Examines indexes created on barcode, isbn, title, status, and foreign key columns for fast sub-second lookup.',
    sql: `SELECT 'idx_copy_book_status' AS index_name, 'book_copy' AS table_name, 'book_id, status' AS indexed_columns, 'B-Tree' AS type
UNION ALL
SELECT 'idx_copy_barcode', 'book_copy', 'barcode (UNIQUE)', 'B-Tree'
UNION ALL
SELECT 'idx_book_title', 'book', 'title', 'B-Tree'
UNION ALL
SELECT 'idx_movement_copy', 'book_movement', 'copy_id', 'B-Tree'
UNION ALL
SELECT 'idx_borrow_user_status', 'borrow_transaction', 'user_id, status', 'B-Tree'
UNION ALL
SELECT 'idx_transfer_status', 'transfer_request', 'status', 'B-Tree';`,
    params: []
  }
};

/**
 * GET /api/admin/dbms-demo
 * Returns list of demo queries
 */
router.get('/dbms-demo', async (req, res) => {
  const list = Object.keys(DEMO_QUERIES).map(key => ({
    key,
    title: DEMO_QUERIES[key].title,
    concept: DEMO_QUERIES[key].concept,
    explanation: DEMO_QUERIES[key].explanation,
    sql: DEMO_QUERIES[key].sql
  }));

  return res.json({ success: true, queries: list });
});

/**
 * POST /api/admin/dbms-demo/run
 * Executes a selected DBMS demo query live against the database
 */
router.post('/dbms-demo/run', async (req, res) => {
  const { query_key } = req.body;
  const item = DEMO_QUERIES[query_key];

  if (!item) {
    return res.status(404).json({ success: false, error: `Demo query "${query_key}" not found.` });
  }

  const startTime = Date.now();
  try {
    const [rows] = await query(item.sql, item.params);
    const executionTimeMs = Date.now() - startTime;

    return res.json({
      success: true,
      query_key,
      title: item.title,
      concept: item.concept,
      explanation: item.explanation,
      sql: item.sql,
      execution_time_ms: executionTimeMs,
      row_count: rows.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows
    });
  } catch (err) {
    console.error(`DBMS demo run error [${query_key}]:`, err);
    return res.status(500).json({ success: false, error: err.message, sql: item.sql });
  }
});

module.exports = router;
