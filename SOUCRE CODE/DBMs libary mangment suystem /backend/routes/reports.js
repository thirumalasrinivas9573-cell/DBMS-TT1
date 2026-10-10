const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// All report endpoints require authentication and staff/admin role
router.use(authenticate, requireRole('LIBRARIAN', 'ADMIN'));

/**
 * GET /api/reports/stock
 * Branch-level or network-wide stock report
 */
router.get('/stock', async (req, res) => {
  try {
    let sql = `
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
      JOIN book b    ON b.book_id = bc.book_id
      JOIN author a  ON a.author_id = b.author_id
      LEFT JOIN category c ON c.category_id = b.category_id
      WHERE 1=1
    `;

    const params = [];

    if (req.user.role === 'LIBRARIAN') {
      sql += ' AND bc.library_id = ?';
      params.push(req.user.library_id);
    } else if (req.query.library_id) {
      sql += ' AND bc.library_id = ?';
      params.push(parseInt(req.query.library_id, 10));
    }

    sql += ' GROUP BY l.library_id, l.library_name, b.book_id, b.title, a.author_name, c.category_name ORDER BY l.library_name, b.title';

    const [rows] = await query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      report: rows.map(r => ({
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
    console.error('Stock report error:', err);
    return res.status(500).json({ success: false, error: 'Server error generating stock report.' });
  }
});

/**
 * GET /api/reports/overdue
 * Overdue borrow transactions report (v_overdue)
 */
router.get('/overdue', async (req, res) => {
  try {
    let sql = `
      SELECT 
        bt.transaction_id,
        bt.copy_id,
        bc.barcode,
        b.title,
        bt.user_id,
        u.name AS member_name,
        u.email AS member_email,
        u.phone AS member_phone,
        bt.issue_library_id,
        il.library_name AS issue_library_name,
        bt.issue_date,
        bt.due_date,
        DATEDIFF(CURDATE(), bt.due_date) AS days_overdue,
        ROUND(DATEDIFF(CURDATE(), bt.due_date) * COALESCE(s.setting_value, 5.00), 2) AS estimated_late_fee
      FROM borrow_transaction bt
      JOIN book_copy bc ON bc.copy_id = bt.copy_id
      JOIN book b ON b.book_id = bc.book_id
      JOIN user u ON u.user_id = bt.user_id
      JOIN library il ON il.library_id = bt.issue_library_id
      LEFT JOIN settings s ON s.setting_key = 'late_fee_per_day'
      WHERE bt.status = 'ISSUED' AND bt.due_date < CURDATE()
    `;

    const params = [];

    if (req.user.role === 'LIBRARIAN') {
      sql += ' AND bt.issue_library_id = ?';
      params.push(req.user.library_id);
    } else if (req.query.library_id) {
      sql += ' AND bt.issue_library_id = ?';
      params.push(parseInt(req.query.library_id, 10));
    }

    sql += ' ORDER BY days_overdue DESC';

    const [rows] = await query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      report: rows
    });
  } catch (err) {
    console.error('Overdue report error:', err);
    return res.status(500).json({ success: false, error: 'Server error generating overdue report.' });
  }
});

/**
 * GET /api/reports/revenue
 * Financial audit: revenue breakdown by charge type (Admin only)
 */
router.get('/revenue', requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT 
        COUNT(bt.transaction_id) AS total_settled_transactions,
        COALESCE(SUM(bt.deposit_amount), 0) AS total_deposits_collected,
        COALESCE(SUM(bt.late_fee), 0) AS total_late_fees,
        COALESCE(SUM(bt.transfer_charge), 0) AS total_transfer_charges,
        COALESCE(SUM(bt.refund_amount), 0) AS total_refunded_to_members,
        COALESCE(SUM(bt.late_fee + bt.transfer_charge), 0) AS net_revenue
      FROM borrow_transaction bt
      WHERE bt.status IN ('RETURNED', 'RETURNED_ALT_LIBRARY')
    `);

    return res.json({
      success: true,
      revenue_summary: rows[0]
    });
  } catch (err) {
    console.error('Revenue report error:', err);
    return res.status(500).json({ success: false, error: 'Server error generating revenue report.' });
  }
});

/**
 * GET /api/reports/most-moved
 * Top physically relocated copies
 */
router.get('/most-moved', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;

    let sql = `
      SELECT 
        bc.copy_id,
        bc.barcode,
        b.title,
        l.library_id,
        l.library_name AS current_library,
        COUNT(bm.movement_id) AS total_movements,
        MAX(bm.scan_time) AS last_scanned_at
      FROM book_copy bc
      JOIN book b ON b.book_id = bc.book_id
      JOIN library l ON l.library_id = bc.library_id
      JOIN book_movement bm ON bm.copy_id = bc.copy_id
      WHERE 1=1
    `;

    const params = [];

    if (req.user.role === 'LIBRARIAN') {
      sql += ' AND bc.library_id = ?';
      params.push(req.user.library_id);
    }

    sql += ` GROUP BY bc.copy_id, bc.barcode, b.title, l.library_id, l.library_name
             ORDER BY total_movements DESC, last_scanned_at DESC
             LIMIT ?`;
    params.push(limit);

    const [rows] = await query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      most_moved_copies: rows
    });
  } catch (err) {
    console.error('Most moved report error:', err);
    return res.status(500).json({ success: false, error: 'Server error generating movement report.' });
  }
});

module.exports = router;
