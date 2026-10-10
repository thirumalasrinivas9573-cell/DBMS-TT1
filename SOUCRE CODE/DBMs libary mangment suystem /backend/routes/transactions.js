const express = require('express');
const router = express.Router();
const { getConnection, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const ChargeService = require('../services/chargeService');
const { haversineDistance } = require('../services/distanceService');
const AlertService = require('../services/alertService');

/**
 * POST /api/transactions/issue
 * Issue a book copy to a member (FR-12, Section 9.4, Section 12)
 * Request body:
 * {
 *   copy_id: 1, // or barcode
 *   user_id: 4,
 *   due_days: 14, // optional, default 14
 *   deposit_amount: 500 // optional, default from settings
 * }
 */
router.post('/issue', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const { copy_id, barcode, user_id, due_days = 14, deposit_amount } = req.body;

  if ((!copy_id && !barcode) || !user_id) {
    return res.status(400).json({
      success: false,
      error: 'copy_id (or barcode) and user_id are required.'
    });
  }

  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch copy with row lock
    let copyQuery = `
      SELECT bc.copy_id, bc.book_id, bc.library_id, bc.barcode, bc.status, b.title
      FROM book_copy bc
      JOIN book b ON b.book_id = bc.book_id
      WHERE 
    `;
    const copyParams = [];
    if (copy_id) {
      copyQuery += ' bc.copy_id = ?';
      copyParams.push(copy_id);
    } else {
      copyQuery += ' bc.barcode = ?';
      copyParams.push(barcode.trim());
    }
    copyQuery += ' FOR UPDATE';

    const [copies] = await conn.query(copyQuery, copyParams);

    if (copies.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Book copy not found.' });
    }

    const copy = copies[0];

    // Role check: Librarian can only issue from their own library
    if (req.user.role === 'LIBRARIAN' && Number(copy.library_id) !== Number(req.user.library_id)) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        error: `Permission denied: Copy is located at Library #${copy.library_id}, but your station is Library #${req.user.library_id}.`
      });
    }

    if (copy.status !== 'AVAILABLE') {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        error: `Copy ${copy.barcode} is not available for issue. Current status: ${copy.status}`
      });
    }

    // 2. Fetch member
    const [members] = await conn.query('SELECT user_id, name, email FROM user WHERE user_id = ?', [user_id]);
    if (members.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Member not found.' });
    }
    const member = members[0];

    // 3. Determine deposit
    const settings = await ChargeService.getSettings(conn);
    const deposit = deposit_amount !== undefined ? parseFloat(deposit_amount) : settings.deposit_amount;
    const issueLibraryId = copy.library_id;

    // 4. Calculate issue and due date
    const days = parseInt(due_days, 10) || 14;
    const now = new Date();
    const issueDateStr = now.toISOString().split('T')[0];
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + days);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const [transResult] = await conn.query(`
      INSERT INTO borrow_transaction (
        copy_id,
        user_id,
        issue_library_id,
        return_library_id,
        issue_date,
        due_date,
        return_date,
        deposit_amount,
        late_fee,
        transfer_distance_km,
        transfer_charge,
        refund_amount,
        status
      ) VALUES (
        ?, ?, ?, NULL,
        ?,
        ?,
        NULL,
        ?, 0.00, 0.00, 0.00, NULL, 'ISSUED'
      )
    `, [copy.copy_id, member.user_id, issueLibraryId, issueDateStr, dueDateStr, deposit]);

    const transactionId = transResult.insertId;

    // 5. Update book copy to BORROWED
    await conn.query(`
      UPDATE book_copy 
      SET status = 'BORROWED',
          current_location_type = 'NONE',
          current_location_id = NULL
      WHERE copy_id = ?
    `, [copy.copy_id]);

    // 6. Log BOOK_MOVEMENT
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
      ) VALUES (?, 'RACK', NULL, 'NONE', NULL, ?, NOW(), 'ISSUED')
    `, [copy.copy_id, req.user.user_id]);

    // 7. Notification for member
    await conn.query(`
      INSERT INTO notification (user_id, transaction_id, type, message, sent_at, status)
      VALUES (?, ?, 'DUE_REMINDER', CONCAT('You have borrowed "', ?, '". Deposit held: ₹', ?, '. Due date is in ', ?, ' days.'), NOW(), 'UNREAD')
    `, [member.user_id, transactionId, copy.title, deposit.toFixed(2), days]);

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: `Book "${copy.title}" issued successfully to ${member.name}.`,
      transaction_id: transactionId,
      copy_id: copy.copy_id,
      barcode: copy.barcode,
      deposit_amount: deposit,
      issue_date: new Date().toISOString().split('T')[0],
      due_days: days
    });

  } catch (err) {
    await conn.rollback();
    console.error('Issue book error:', err);
    return res.status(500).json({ success: false, error: 'Database transaction error issuing copy.' });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/transactions/:id/return
 * Return a copy at this library (own or alternate library)
 * (FR-13, FR-14, FR-15, Section 9.4, 9.5, 11.6, TC-07, TC-08)
 */
router.post('/:id/return', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  const transactionId = parseInt(req.params.id, 10);
  if (isNaN(transactionId)) {
    return res.status(400).json({ success: false, error: 'Invalid transaction ID.' });
  }

  // Receiving library: defaults to librarian's assigned library, or body override for admin
  const returnLibId = req.user.role === 'ADMIN' 
    ? (req.body.return_library_id || req.user.library_id || 1)
    : req.user.library_id;

  if (!returnLibId) {
    return res.status(400).json({ success: false, error: 'Return library branch must be designated.' });
  }

  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch active transaction with lock
    const [transactions] = await conn.query(`
      SELECT 
        bt.transaction_id,
        bt.copy_id,
        bt.user_id,
        bt.issue_library_id,
        bt.issue_date,
        bt.due_date,
        bt.deposit_amount,
        bt.status,
        bc.barcode,
        b.title,
        u.name AS member_name,
        il.latitude AS issue_lat,
        il.longitude AS issue_lng,
        il.library_name AS issue_lib_name
      FROM borrow_transaction bt
      JOIN book_copy bc ON bc.copy_id = bt.copy_id
      JOIN book b ON b.book_id = bc.book_id
      JOIN user u ON u.user_id = bt.user_id
      JOIN library il ON il.library_id = bt.issue_library_id
      WHERE bt.transaction_id = ?
      FOR UPDATE
    `, [transactionId]);

    if (transactions.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Borrow transaction not found.' });
    }

    const tx = transactions[0];

    if (tx.status !== 'ISSUED' && tx.status !== 'OVERDUE') {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        error: `Transaction #${transactionId} is already closed (Status: ${tx.status}).`
      });
    }

    // 2. Fetch return library coordinates
    const [returnLibs] = await conn.query(
      'SELECT library_id, library_name, latitude, longitude FROM library WHERE library_id = ?',
      [returnLibId]
    );

    if (returnLibs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Return library branch does not exist.' });
    }
    const returnLib = returnLibs[0];

    // 3. Fetch rates from settings
    const settings = await ChargeService.getSettings(conn);

    // 4. Calculate Distance and Transfer Charge
    const isAlternateLibrary = Number(tx.issue_library_id) !== Number(returnLibId);
    let distanceKm = 0;
    let transferCharge = 0;

    if (isAlternateLibrary) {
      distanceKm = req.body.distance_km !== undefined 
        ? parseFloat(req.body.distance_km)
        : haversineDistance(
            tx.issue_lat,
            tx.issue_lng,
            returnLib.latitude,
            returnLib.longitude
          );
      transferCharge = ChargeService.calculateTransferCharge(distanceKm, settings.rate_per_km);
    }

    // 5. Calculate Late Fee (TC-08)
    const returnDateStr = req.body.return_date || new Date().toISOString().split('T')[0];
    const { daysOverdue, lateFee } = ChargeService.calculateLateFee(
      tx.due_date,
      returnDateStr,
      settings.late_fee_per_day
    );

    // 6. Calculate Net Refund (Section 9.5 & 11.6: refund = deposit - late_fee - transfer_charge)
    const depositAmount = parseFloat(tx.deposit_amount);
    const refundAmount = ChargeService.calculateRefund(depositAmount, lateFee, transferCharge);

    const newStatus = isAlternateLibrary ? 'RETURNED_ALT_LIBRARY' : 'RETURNED';

    // TC-11: Support simulated failure midway through transaction
    if (req.body.simulate_error) {
      throw new Error('Simulated failure midway through transaction (TC-11)');
    }

    // 7. Update borrow_transaction per Section 11.6
    await conn.query(`
      UPDATE borrow_transaction
      SET return_library_id = ?,
          return_date = ?,
          transfer_distance_km = ?,
          transfer_charge = ?,
          late_fee = ?,
          refund_amount = ?,
          status = ?
      WHERE transaction_id = ?
    `, [
      returnLibId,
      returnDateStr,
      distanceKm,
      transferCharge,
      lateFee,
      refundAmount,
      newStatus,
      tx.transaction_id
    ]);

    // 8. Update book_copy (per Section 11.6: set library_id to return_library_id, status to 'RETURNING')
    await conn.query(`
      UPDATE book_copy
      SET library_id = ?,
          status = 'RETURNING',
          current_location_type = 'NONE',
          current_location_id = NULL
      WHERE copy_id = ?
    `, [returnLibId, tx.copy_id]);

    // 9. Append to BOOK_MOVEMENT
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
      ) VALUES (?, 'NONE', NULL, 'NONE', NULL, ?, NOW(), 'RETURNED')
    `, [tx.copy_id, req.user.user_id]);

    // 10. Member Notification
    let returnNotifMessage = `Return confirmed for "${tx.title}" at ${returnLib.library_name}. `;
    if (isAlternateLibrary) {
      returnNotifMessage += `Transit distance: ${distanceKm} km (Fee: ₹${transferCharge.toFixed(2)}). `;
    }
    if (lateFee > 0) {
      returnNotifMessage += `Overdue by ${daysOverdue} days (Late fee: ₹${lateFee.toFixed(2)}). `;
    }
    returnNotifMessage += `Net refund: ₹${refundAmount.toFixed(2)} (from deposit ₹${depositAmount.toFixed(2)}).`;

    await conn.query(`
      INSERT INTO notification (user_id, transaction_id, type, message, sent_at, status)
      VALUES (?, ?, 'RETURN_CONFIRMATION', ?, NOW(), 'UNREAD')
    `, [tx.user_id, tx.transaction_id, returnNotifMessage]);

    await conn.commit();

    return res.json({
      success: true,
      message: 'Book return successfully processed.',
      transaction_id: tx.transaction_id,
      copy_id: tx.copy_id,
      barcode: tx.barcode,
      book_title: tx.title,
      is_alternate_library: isAlternateLibrary,
      issue_library: tx.issue_lib_name,
      return_library: returnLib.library_name,
      financials: {
        deposit_amount: depositAmount,
        distance_km: distanceKm,
        rate_per_km: settings.rate_per_km,
        transfer_charge: transferCharge,
        days_overdue: daysOverdue,
        late_fee_per_day: settings.late_fee_per_day,
        late_fee: lateFee,
        refund_amount: refundAmount
      },
      status: newStatus
    });

  } catch (err) {
    await conn.rollback();
    console.error('Return book error:', err);
    return res.status(500).json({ success: false, error: 'Database transaction error processing return.' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/me/transactions
 * Retrieve borrowings of the logged-in member (Section 8.2, Section 12)
 */
router.get('/me/transactions', authenticate, async (req, res) => {
  try {
    const [transactions] = await query(`
      SELECT 
        bt.transaction_id,
        bt.copy_id,
        bc.barcode,
        b.title,
        b.isbn,
        bt.issue_date,
        bt.due_date,
        bt.return_date,
        bt.deposit_amount,
        bt.late_fee,
        bt.transfer_distance_km,
        bt.transfer_charge,
        bt.refund_amount,
        bt.status,
        il.library_name AS issue_library,
        rl.library_name AS return_library
      FROM borrow_transaction bt
      JOIN book_copy bc ON bc.copy_id = bt.copy_id
      JOIN book b ON b.book_id = bc.book_id
      JOIN library il ON il.library_id = bt.issue_library_id
      LEFT JOIN library rl ON rl.library_id = bt.return_library_id
      WHERE bt.user_id = ?
      ORDER BY bt.transaction_id DESC
    `, [req.user.user_id]);

    return res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    console.error('Member transactions error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving borrowing history.' });
  }
});

/**
 * GET /api/transactions
 * Librarian / Admin: List transactions with optional filters
 */
router.get('/', authenticate, requireRole('LIBRARIAN', 'ADMIN'), async (req, res) => {
  try {
    let sql = `
      SELECT 
        bt.transaction_id,
        bt.copy_id,
        bc.barcode,
        b.title,
        u.name AS member_name,
        u.email AS member_email,
        bt.issue_date,
        bt.due_date,
        bt.return_date,
        bt.deposit_amount,
        bt.late_fee,
        bt.transfer_charge,
        bt.refund_amount,
        bt.status,
        il.library_name AS issue_library,
        rl.library_name AS return_library
      FROM borrow_transaction bt
      JOIN book_copy bc ON bc.copy_id = bt.copy_id
      JOIN book b ON b.book_id = bc.book_id
      JOIN user u ON u.user_id = bt.user_id
      JOIN library il ON il.library_id = bt.issue_library_id
      LEFT JOIN library rl ON rl.library_id = bt.return_library_id
      WHERE 1=1
    `;

    const params = [];

    if (req.user.role === 'LIBRARIAN') {
      sql += ' AND (bt.issue_library_id = ? OR bt.return_library_id = ?)';
      params.push(req.user.library_id, req.user.library_id);
    }

    if (req.query.status) {
      sql += ' AND bt.status = ?';
      params.push(req.query.status);
    }

    sql += ' ORDER BY bt.transaction_id DESC LIMIT 100';

    const [transactions] = await query(sql, params);

    return res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    console.error('List transactions error:', err);
    return res.status(500).json({ success: false, error: 'Server error listing transactions.' });
  }
});

module.exports = router;
