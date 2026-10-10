const express = require('express');
const router = express.Router();
const { query, getConnection } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * GET /api/copies/:barcode/history
 * Movement history of a copy (Copy Tracker timeline)
 * (FR-19, Section 11.5, Section 12)
 */
router.get('/:barcode/history', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  try {
    const barcode = req.params.barcode.trim();

    // Verify copy exists
    const [copies] = await query(`
      SELECT 
        bc.copy_id,
        bc.barcode,
        bc.status,
        bc.current_location_type,
        bc.current_location_id,
        bc.library_id,
        b.title,
        b.isbn,
        l.library_name,
        hr.rack_number AS home_rack_number
      FROM book_copy bc
      JOIN book b ON b.book_id = bc.book_id
      JOIN library l ON l.library_id = bc.library_id
      LEFT JOIN rack hr ON hr.rack_id = bc.home_rack_id
      WHERE bc.barcode = ?
    `, [barcode]);

    if (copies.length === 0) {
      return res.status(404).json({ success: false, error: `Copy with barcode "${barcode}" not found.` });
    }

    const copy = copies[0];

    // Query full movement history ordered chronologically
    const [movements] = await query(`
      SELECT 
        m.movement_id,
        m.scan_time,
        m.movement_type,
        m.from_location_type,
        m.from_location_id,
        m.to_location_type,
        m.to_location_id,
        u.name AS scanned_by,
        u.role AS user_role
      FROM book_movement m
      LEFT JOIN user u ON u.user_id = m.user_id
      WHERE m.copy_id = ?
      ORDER BY m.scan_time ASC
    `, [copy.copy_id]);

    return res.json({
      success: true,
      copy,
      total_movements: movements.length,
      history: movements
    });
  } catch (err) {
    console.error('Copy history error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving copy history.' });
  }
});

/**
 * GET /api/copies
 * List copies for the librarian's library
 */
router.get('/', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  try {
    let libId = req.user.library_id;
    if (req.user.role === 'ADMIN' && req.query.library_id) {
      libId = parseInt(req.query.library_id, 10);
    }

    const params = [];
    let sql = `
      SELECT 
        bc.copy_id,
        bc.barcode,
        bc.status,
        bc.current_location_type,
        bc.current_location_id,
        b.book_id,
        b.title,
        b.isbn,
        l.library_id,
        l.library_name,
        r.rack_number AS home_rack_number
      FROM book_copy bc
      JOIN book b ON b.book_id = bc.book_id
      JOIN library l ON l.library_id = bc.library_id
      LEFT JOIN rack r ON r.rack_id = bc.home_rack_id
      WHERE 1=1
    `;

    if (libId) {
      sql += ' AND bc.library_id = ?';
      params.push(libId);
    }

    if (req.query.status) {
      sql += ' AND bc.status = ?';
      params.push(req.query.status);
    }

    sql += ' ORDER BY bc.copy_id DESC';

    const [copies] = await query(sql, params);

    return res.json({
      success: true,
      count: copies.length,
      copies
    });
  } catch (err) {
    console.error('Fetch copies error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving copies.' });
  }
});

/**
 * POST /api/copies
 * Add a new physical copy with barcode (FR-04, TC-02, Section 12)
 */
router.post('/', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { book_id, barcode, library_id, home_rack_id } = req.body;

  if (!book_id || !barcode) {
    return res.status(400).json({
      success: false,
      error: 'book_id and barcode are required.'
    });
  }

  // Determine library: librarian can only add to own library
  let targetLibId = req.user.role === 'ADMIN' ? (library_id || req.user.library_id || 1) : req.user.library_id;

  if (!targetLibId) {
    return res.status(400).json({ success: false, error: 'Target library_id must be specified.' });
  }

  // Check unique barcode constraint (TC-02)
  const [existing] = await query('SELECT copy_id FROM book_copy WHERE barcode = ?', [barcode.trim()]);
  if (existing.length > 0) {
    return res.status(409).json({
      success: false,
      error: `Duplicate barcode: A copy with barcode "${barcode}" already exists.`
    });
  }

  // Check book exists
  const [bookRows] = await query('SELECT book_id, title FROM book WHERE book_id = ?', [book_id]);
  if (bookRows.length === 0) {
    return res.status(404).json({ success: false, error: 'Referenced book ID does not exist.' });
  }

  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(`
      INSERT INTO book_copy (
        book_id,
        library_id,
        barcode,
        status,
        current_location_type,
        current_location_id,
        home_rack_id
      ) VALUES (?, ?, ?, 'AVAILABLE', 'RACK', ?, ?)
    `, [
      book_id,
      targetLibId,
      barcode.trim(),
      home_rack_id || null,
      home_rack_id || null
    ]);

    const newCopyId = result.insertId;

    // Log initial movement
    await conn.query(`
      INSERT INTO book_movement (
        copy_id,
        from_location_type,
        from_location_id,
        to_location_type,
        to_location_id,
        user_id,
        scan_time,
        movement_type
      ) VALUES (?, 'NONE', NULL, 'RACK', ?, ?, NOW(), 'PLACED_RACK')
    `, [newCopyId, home_rack_id || null, req.user.user_id]);

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'New book copy registered successfully.',
      copy_id: newCopyId,
      barcode: barcode.trim(),
      library_id: targetLibId
    });
  } catch (err) {
    await conn.rollback();
    console.error('Create copy error:', err);
    return res.status(500).json({ success: false, error: 'Database error while creating copy.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
