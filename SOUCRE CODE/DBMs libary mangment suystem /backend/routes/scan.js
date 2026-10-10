const express = require('express');
const router = express.Router();
const { getConnection, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const AlertService = require('../services/alertService');

/**
 * Helper to resolve a location barcode to a RACK or READING_TABLE within a library
 */
async function resolveLocation(locationBarcode, libraryId, connOrPool) {
  const code = String(locationBarcode).trim();
  const runQuery = connOrPool.query.bind(connOrPool);

  // 1. Check if it matches a rack by rack_number or formatted code
  const cleanRackCode = code.replace(/^RACK[:-]?/i, '');
  const [racks] = await runQuery(
    'SELECT rack_id, rack_number, category FROM rack WHERE library_id = ? AND (rack_number = ? OR rack_number = ?)',
    [libraryId, code, cleanRackCode]
  );
  if (racks.length > 0) {
    return { type: 'RACK', entity: racks[0] };
  }

  // 2. Check if it matches a reading table by table_number or formatted code
  const cleanTableCode = code.replace(/^TABLE[:-]?/i, '');
  const [tables] = await runQuery(
    'SELECT table_id, table_number, area_name FROM reading_table WHERE library_id = ? AND (table_number = ? OR table_number = ?)',
    [libraryId, code, cleanTableCode]
  );
  if (tables.length > 0) {
    return { type: 'TABLE', entity: tables[0] };
  }

  // 3. Fallback: check by ID if numeric
  if (/^\d+$/.test(code)) {
    const numId = parseInt(code, 10);
    const [rackById] = await runQuery('SELECT rack_id, rack_number, category FROM rack WHERE library_id = ? AND rack_id = ?', [libraryId, numId]);
    if (rackById.length > 0) return { type: 'RACK', entity: rackById[0] };

    const [tableById] = await runQuery('SELECT table_id, table_number, area_name FROM reading_table WHERE library_id = ? AND table_id = ?', [libraryId, numId]);
    if (tableById.length > 0) return { type: 'TABLE', entity: tableById[0] };
  }

  return null;
}

/**
 * POST /api/scan
 * Two-step physical tracking scan (FR-06, FR-07, FR-08, Section 9.1, 9.2, 12)
 * Request body:
 * {
 *   book_barcode: "LIB-A-BC1023",
 *   location_barcode: "R01" | "T01" (optional for single-step pickup scan)
 * }
 */
router.post('/', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { book_barcode, location_barcode } = req.body;

  if (!book_barcode) {
    return res.status(400).json({
      success: false,
      error: 'book_barcode is required.'
    });
  }

  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch book copy and its expected home rack
    const [copyRows] = await conn.query(`
      SELECT 
        bc.copy_id,
        bc.book_id,
        bc.library_id,
        bc.barcode,
        bc.status,
        bc.current_location_type,
        bc.current_location_id,
        bc.home_rack_id,
        b.title,
        hr.rack_number AS expected_rack_number
      FROM book_copy bc
      JOIN book b ON b.book_id = bc.book_id
      LEFT JOIN rack hr ON hr.rack_id = bc.home_rack_id
      WHERE (bc.barcode = ? OR bc.barcode = ? OR bc.barcode = ?)
      FOR UPDATE
    `, [book_barcode.trim(), 'LIB-A-' + book_barcode.trim(), book_barcode.trim().replace(/^LIB-[A-Z]-/, '')]);

    if (copyRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        error: `Book copy with barcode "${book_barcode}" does not exist.`
      });
    }

    const copy = copyRows[0];

    // Role check: Librarian can only scan copies belonging to their own library
    if (req.user.role === 'LIBRARIAN' && Number(copy.library_id) !== Number(req.user.library_id)) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        error: `Access denied: Copy belongs to Library #${copy.library_id}. You are assigned to Library #${req.user.library_id}.`
      });
    }

    const effectiveLibId = copy.library_id;
    const prevLocationType = copy.current_location_type || 'NONE';
    const prevLocationId = copy.current_location_id || null;

    let newStatus = copy.status;
    let newLocationType = 'NONE';
    let newLocationId = null;
    let movementType = 'PICKED';
    let wrongRackResult = null;
    let scanDescription = '';

    // 2. Evaluate State Transitions from Section 9.1
    if (location_barcode && String(location_barcode).trim()) {
      const locResolved = await resolveLocation(location_barcode, effectiveLibId, conn);

      if (!locResolved) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          error: `Location barcode "${location_barcode}" was not recognized as a valid rack or reading table in Library #${effectiveLibId}.`
        });
      }

      if (locResolved.type === 'RACK') {
        // Book placed back on rack -> AVAILABLE
        newStatus = 'AVAILABLE';
        newLocationType = 'RACK';
        newLocationId = locResolved.entity.rack_id;
        movementType = 'PLACED_RACK';
        scanDescription = `Book placed on Rack ${locResolved.entity.rack_number}.`;

        // Section 9.2: Wrong-Rack Detection
        wrongRackResult = await AlertService.checkAndAlertWrongRack(conn, {
          copy,
          scannedRack: locResolved.entity,
          user: req.user
        });
      } else if (locResolved.type === 'TABLE') {
        // Student sits at table -> READING
        newStatus = 'READING';
        newLocationType = 'TABLE';
        newLocationId = locResolved.entity.table_id;
        movementType = 'PLACED_TABLE';
        scanDescription = `Book placed at Reading Table ${locResolved.entity.table_number} (${locResolved.entity.area_name || 'Study Area'}).`;
      }
    } else {
      // Single scan (Book barcode only)
      if (copy.status === 'READING' || copy.current_location_type === 'TABLE') {
        // Student finishes reading -> RETURNING
        newStatus = 'RETURNING';
        newLocationType = 'NONE';
        newLocationId = null;
        movementType = 'PICKED';
        scanDescription = 'Student finished reading. Book marked as RETURNING to circulation counter.';
      } else {
        // Book leaves Rack -> IN_TRANSIT
        newStatus = 'IN_TRANSIT';
        newLocationType = 'NONE';
        newLocationId = null;
        movementType = 'PICKED';
        scanDescription = `Book picked from ${prevLocationType === 'RACK' ? 'rack' : 'location'}. Book is now IN_TRANSIT with reader.`;
      }
    }

    // 3. Update BOOK_COPY
    await conn.query(`
      UPDATE book_copy
      SET status = ?,
          current_location_type = ?,
          current_location_id = ?
      WHERE copy_id = ?
    `, [newStatus, newLocationType, newLocationId, copy.copy_id]);

    // 4. Insert into append-only BOOK_MOVEMENT log (FR-07)
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
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    `, [
      copy.copy_id,
      prevLocationType,
      prevLocationId,
      newLocationType,
      newLocationId,
      req.user.user_id,
      movementType
    ]);

    await conn.commit();

    return res.json({
      success: true,
      message: scanDescription,
      barcode: copy.barcode,
      book_title: copy.title,
      status: newStatus,
      location: {
        type: newLocationType,
        id: newLocationId
      },
      movement_type: movementType,
      wrong_rack: wrongRackResult ? {
        is_wrong_rack: wrongRackResult.isWrongRack,
        message: wrongRackResult.message,
        expected_rack: copy.expected_rack_number,
        actual_rack: wrongRackResult.actualRackNumber
      } : { is_wrong_rack: false }
    });

  } catch (err) {
    await conn.rollback();
    console.error('Scan transaction error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected database error occurred during scan operation.'
    });
  } finally {
    conn.release();
  }
});

module.exports = router;
