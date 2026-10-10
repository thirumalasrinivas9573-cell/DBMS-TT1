const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * GET /api/libraries
 * List all library branches (FR-02, Section 8.1, Section 12)
 */
router.get('/', async (req, res) => {
  try {
    const [libraries] = await query(`
      SELECT 
        l.library_id,
        l.library_name,
        l.address,
        l.phone,
        l.email,
        l.latitude,
        l.longitude,
        COUNT(bc.copy_id) AS total_copies,
        SUM(CASE WHEN bc.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_copies
      FROM library l
      LEFT JOIN book_copy bc ON bc.library_id = l.library_id
      GROUP BY l.library_id, l.library_name, l.address, l.phone, l.email, l.latitude, l.longitude
      ORDER BY l.library_id ASC
    `);

    return res.json({
      success: true,
      count: libraries.length,
      libraries: libraries.map(lib => ({
        ...lib,
        latitude: parseFloat(lib.latitude),
        longitude: parseFloat(lib.longitude),
        total_copies: Number(lib.total_copies || 0),
        available_copies: Number(lib.available_copies || 0)
      }))
    });
  } catch (err) {
    console.error('Fetch libraries error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving libraries.' });
  }
});

/**
 * GET /api/libraries/:id
 * Retrieve details for a single library including its racks and tables
 */
router.get('/:id', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id, 10);
    if (isNaN(libraryId)) {
      return res.status(400).json({ success: false, error: 'Invalid library ID.' });
    }

    const [libRows] = await query(
      'SELECT library_id, library_name, address, phone, email, latitude, longitude FROM library WHERE library_id = ?',
      [libraryId]
    );

    if (libRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Library branch not found.' });
    }

    const [racks] = await query(
      'SELECT rack_id, rack_number, category FROM rack WHERE library_id = ? ORDER BY rack_number ASC',
      [libraryId]
    );

    const [tables] = await query(
      'SELECT table_id, table_number, area_name FROM reading_table WHERE library_id = ? ORDER BY table_number ASC',
      [libraryId]
    );

    return res.json({
      success: true,
      library: {
        ...libRows[0],
        latitude: parseFloat(libRows[0].latitude),
        longitude: parseFloat(libRows[0].longitude),
        racks,
        reading_tables: tables
      }
    });
  } catch (err) {
    console.error('Library details error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving library details.' });
  }
});

/**
 * POST /api/libraries
 * Admin: Add a new library branch (FR-02)
 */
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { library_name, address, phone, email, latitude, longitude } = req.body;

    if (!library_name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'library_name, latitude, and longitude are required.'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ success: false, error: 'Latitude must be between -90 and 90.' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, error: 'Longitude must be between -180 and 180.' });
    }

    const [result] = await query(
      `INSERT INTO library (library_name, address, phone, email, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [library_name.trim(), address || null, phone || null, email || null, lat, lng]
    );

    return res.status(201).json({
      success: true,
      message: 'Library branch added successfully.',
      library_id: result.insertId
    });
  } catch (err) {
    console.error('Create library error:', err);
    return res.status(500).json({ success: false, error: 'Server error creating library.' });
  }
});

/**
 * PUT /api/libraries/:id
 * Admin: Update library branch details
 */
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id, 10);
    const { library_name, address, phone, email, latitude, longitude } = req.body;

    const [existing] = await query('SELECT library_id FROM library WHERE library_id = ?', [libraryId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Library branch not found.' });
    }

    await query(
      `UPDATE library 
       SET library_name = COALESCE(?, library_name),
           address = COALESCE(?, address),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           latitude = COALESCE(?, latitude),
           longitude = COALESCE(?, longitude)
       WHERE library_id = ?`,
      [library_name || null, address || null, phone || null, email || null, latitude || null, longitude || null, libraryId]
    );

    return res.json({
      success: true,
      message: 'Library updated successfully.'
    });
  } catch (err) {
    console.error('Update library error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating library.' });
  }
});

module.exports = router;
