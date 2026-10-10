const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * GET /api/alerts/wrong-rack
 * List wrong-rack misplaced copies for librarian's library (FR-08, Section 8.3, Section 11.4, Section 12)
 */
router.get('/wrong-rack', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  try {
    let sql = `
      SELECT 
        bc.copy_id,
        bc.barcode,
        b.book_id,
        b.title,
        bc.library_id,
        l.library_name,
        bc.home_rack_id AS expected_rack_id,
        hr.rack_number AS expected_rack,
        bc.current_location_id AS actual_rack_id,
        cr.rack_number AS actual_rack,
        bc.status
      FROM book_copy bc
      JOIN book b ON b.book_id = bc.book_id
      JOIN library l ON l.library_id = bc.library_id
      JOIN rack hr ON hr.rack_id = bc.home_rack_id
      JOIN rack cr ON (bc.current_location_type = 'RACK' AND cr.rack_id = bc.current_location_id)
      WHERE bc.current_location_id <> bc.home_rack_id
    `;

    const params = [];

    // Librarians only view alerts for their assigned branch
    if (req.user.role === 'LIBRARIAN') {
      sql += ' AND bc.library_id = ?';
      params.push(req.user.library_id);
    } else if (req.query.library_id) {
      sql += ' AND bc.library_id = ?';
      params.push(parseInt(req.query.library_id, 10));
    }

    sql += ' ORDER BY bc.library_id ASC, bc.copy_id DESC';

    const [alerts] = await query(sql, params);

    return res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (err) {
    console.error('Wrong rack alerts error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving wrong-rack alerts.' });
  }
});

module.exports = router;
