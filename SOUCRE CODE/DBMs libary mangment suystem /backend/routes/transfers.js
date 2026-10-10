const express = require('express');
const router = express.Router();
const { getConnection, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const TransferService = require('../services/transferService');

/**
 * POST /api/transfers
 * Create a new transfer request (FR-16, TC-09, Section 9.6, Section 12)
 * Request body:
 * {
 *   copy_id: 1,
 *   source_library_id: 1,
 *   destination_library_id: 2
 * }
 */
router.post('/', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { copy_id, source_library_id, destination_library_id } = req.body;

  if (!copy_id || !source_library_id || !destination_library_id) {
    return res.status(400).json({
      success: false,
      error: 'copy_id, source_library_id, and destination_library_id are required.'
    });
  }

  const srcId = parseInt(source_library_id, 10);
  const dstId = parseInt(destination_library_id, 10);

  // TC-09: CHECK source <> destination
  if (srcId === dstId) {
    return res.status(400).json({
      success: false,
      error: 'Constraint violation: Source library and destination library cannot be the same.'
    });
  }

  // Role check: Librarian can only create transfer involving their library
  if (req.user.role === 'LIBRARIAN' && req.user.library_id !== srcId && req.user.library_id !== dstId) {
    return res.status(403).json({
      success: false,
      error: 'Permission denied: You can only raise transfers involving your assigned library.'
    });
  }

  // Verify copy exists and belongs to source library
  const [copies] = await query('SELECT copy_id, library_id, status FROM book_copy WHERE copy_id = ?', [copy_id]);
  if (copies.length === 0) {
    return res.status(404).json({ success: false, error: 'Book copy not found.' });
  }

  if (Number(copies[0].library_id) !== srcId) {
    return res.status(400).json({
      success: false,
      error: `Copy #${copy_id} is currently at Library #${copies[0].library_id}, not source Library #${srcId}.`
    });
  }

  const [result] = await query(`
    INSERT INTO transfer_request (
      copy_id,
      source_library_id,
      destination_library_id,
      requested_by,
      request_date,
      status
    ) VALUES (?, ?, ?, ?, CURDATE(), 'PENDING')
  `, [copy_id, srcId, dstId, req.user.user_id]);

  const transferId = result.insertId;

  // Notify source library librarians of pending request
  const [srcLibrarians] = await query(
    `SELECT user_id FROM user WHERE role = 'LIBRARIAN' AND library_id = ?`,
    [srcId]
  );
  for (const lib of srcLibrarians) {
    await query(`
      INSERT INTO notification (user_id, transaction_id, type, message, sent_at, status)
      VALUES (?, NULL, 'TRANSFER_UPDATE', CONCAT('New transfer request #', ?, ' for copy #', ?), NOW(), 'UNREAD')
    `, [lib.user_id, transferId, copy_id]);
  }

  return res.status(201).json({
    success: true,
    message: 'Transfer request raised successfully.',
    transfer_id: transferId,
    status: 'PENDING'
  });
});

/**
 * PATCH /api/transfers/:id
 * Advance transfer status through state machine
 * PENDING -> APPROVED -> IN_TRANSIT -> RECEIVED, or CANCELLED (FR-17, TC-10, Section 9.6, Section 12)
 * Request body: { status: 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED' }
 */
router.patch('/:id', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const transferId = parseInt(req.params.id, 10);
  const { status: targetStatus } = req.body;

  if (!targetStatus) {
    return res.status(400).json({ success: false, error: 'target status is required.' });
  }

  const newStatus = targetStatus.trim().toUpperCase();

  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch current transfer request with lock
    const [transfers] = await conn.query(`
      SELECT 
        tr.transfer_id,
        tr.copy_id,
        tr.source_library_id,
        tr.destination_library_id,
        tr.requested_by,
        tr.status,
        bc.barcode,
        b.title
      FROM transfer_request tr
      JOIN book_copy bc ON bc.copy_id = tr.copy_id
      JOIN book b ON b.book_id = bc.book_id
      WHERE tr.transfer_id = ?
      FOR UPDATE
    `, [transferId]);

    if (transfers.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Transfer request not found.' });
    }

    const transfer = transfers[0];

    // 2. State machine validation
    try {
      TransferService.validateTransition(transfer.status, newStatus);
    } catch (validationErr) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        error: validationErr.message
      });
    }

    // Role check: Librarian must belong to source or destination
    if (req.user.role === 'LIBRARIAN') {
      const isParty = req.user.library_id === transfer.source_library_id || req.user.library_id === transfer.destination_library_id;
      if (!isParty) {
        await conn.rollback();
        return res.status(403).json({
          success: false,
          error: 'Permission denied: You are not assigned to either the source or destination library of this transfer.'
        });
      }
    }

    // 3. Apply state change actions
    if (newStatus === 'IN_TRANSIT') {
      // Copy leaves source library
      await conn.query(`
        UPDATE book_copy
        SET status = 'IN_TRANSIT',
            current_location_type = 'NONE',
            current_location_id = NULL
        WHERE copy_id = ?
      `, [transfer.copy_id]);

      // Log movement
      await conn.query(`
        INSERT INTO book_movement (
          copy_id, from_location_type, from_location_id, to_location_type, to_location_id, user_id, scan_time, movement_type
        ) VALUES (?, 'RACK', NULL, 'NONE', NULL, ?, NOW(), 'TRANSFERRED')
      `, [transfer.copy_id, req.user.user_id]);

    } else if (newStatus === 'RECEIVED') {
      // Copy arrived at destination library (TC-10: update copy's library and log movement)
      await conn.query(`
        UPDATE book_copy
        SET library_id = ?,
            status = 'AVAILABLE',
            current_location_type = 'NONE',
            current_location_id = NULL
        WHERE copy_id = ?
      `, [transfer.destination_library_id, transfer.copy_id]);

      // Log movement
      await conn.query(`
        INSERT INTO book_movement (
          copy_id, from_location_type, from_location_id, to_location_type, to_location_id, user_id, scan_time, movement_type
        ) VALUES (?, 'NONE', NULL, 'NONE', NULL, ?, NOW(), 'TRANSFERRED')
      `, [transfer.copy_id, req.user.user_id]);
    }

    // 4. Update transfer request status
    await conn.query(
      'UPDATE transfer_request SET status = ? WHERE transfer_id = ?',
      [newStatus, transfer.transfer_id]
    );

    // 5. Notify the requesting librarian
    await conn.query(`
      INSERT INTO notification (user_id, transaction_id, type, message, sent_at, status)
      VALUES (?, NULL, 'TRANSFER_UPDATE', CONCAT('Transfer #', ?, ' for "', ?, '" transitioned to ', ?), NOW(), 'UNREAD')
    `, [transfer.requested_by, transfer.transfer_id, transfer.title, newStatus]);

    await conn.commit();

    return res.json({
      success: true,
      message: `Transfer #${transferId} updated to ${newStatus}.`,
      transfer_id: transferId,
      previous_status: transfer.status,
      new_status: newStatus,
      copy_id: transfer.copy_id
    });

  } catch (err) {
    await conn.rollback();
    console.error('Update transfer error:', err);
    return res.status(500).json({ success: false, error: 'Database transaction error updating transfer.' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/transfers
 * List transfer requests
 */
router.get('/', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  try {
    let sql = `
      SELECT 
        tr.transfer_id,
        tr.copy_id,
        bc.barcode,
        b.title,
        tr.source_library_id,
        sl.library_name AS source_library,
        tr.destination_library_id,
        dl.library_name AS destination_library,
        tr.requested_by,
        u.name AS requested_by_name,
        tr.request_date,
        tr.status
      FROM transfer_request tr
      JOIN book_copy bc ON bc.copy_id = tr.copy_id
      JOIN book b ON b.book_id = bc.book_id
      JOIN library sl ON sl.library_id = tr.source_library_id
      JOIN library dl ON dl.library_id = tr.destination_library_id
      JOIN user u ON u.user_id = tr.requested_by
      WHERE 1=1
    `;

    const params = [];

    if (req.user.role === 'LIBRARIAN') {
      sql += ' AND (tr.source_library_id = ? OR tr.destination_library_id = ?)';
      params.push(req.user.library_id, req.user.library_id);
    }

    if (req.query.status) {
      sql += ' AND tr.status = ?';
      params.push(req.query.status);
    }

    sql += ' ORDER BY tr.transfer_id DESC';

    const [transfers] = await query(sql, params);

    return res.json({
      success: true,
      count: transfers.length,
      transfers
    });
  } catch (err) {
    console.error('List transfers error:', err);
    return res.status(500).json({ success: false, error: 'Server error listing transfers.' });
  }
});

module.exports = router;
