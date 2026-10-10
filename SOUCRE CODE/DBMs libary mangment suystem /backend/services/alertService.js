const { query } = require('../config/db');

class AlertService {
  /**
   * Insert a notification for a user
   */
  static async sendNotification(executor, { userId, transactionId = null, type, message }) {
    const runQuery = executor ? executor.query.bind(executor) : query;
    const sql = `
      INSERT INTO notification (user_id, transaction_id, type, message, sent_at, status)
      VALUES (?, ?, ?, ?, NOW(), 'UNREAD')
    `;
    const [result] = await runQuery(sql, [userId, transactionId, type, message]);
    return result.insertId;
  }

  /**
   * Notifies all librarians assigned to a specific library
   */
  static async notifyLibrarians(executor, libraryId, { type, message, transactionId = null }) {
    const runQuery = executor ? executor.query.bind(executor) : query;
    const [librarians] = await runQuery(
      `SELECT user_id FROM user WHERE role = 'LIBRARIAN' AND library_id = ?`,
      [libraryId]
    );

    const insertedIds = [];
    if (librarians && librarians.length > 0) {
      for (const lib of librarians) {
        const id = await this.sendNotification(executor, {
          userId: lib.user_id,
          transactionId,
          type,
          message
        });
        insertedIds.push(id);
      }
    }
    return insertedIds;
  }

  /**
   * Performs wrong-rack check and logs notification if misplaced
   */
  static async checkAndAlertWrongRack(executor, { copy, scannedRack, user }) {
    const isWrongRack = Boolean(copy.home_rack_id && scannedRack.rack_id !== copy.home_rack_id);

    if (isWrongRack) {
      const message = `${copy.title} — Copy ${copy.barcode} has been placed in the wrong rack (Scanned: Rack ${scannedRack.rack_number}, Expected: Rack ${copy.expected_rack_number || 'Home Rack'}).`;
      
      // Notify librarians of this library
      await this.notifyLibrarians(executor, copy.library_id, {
        type: 'WRONG_RACK',
        message
      });

      return {
        isWrongRack: true,
        message,
        expectedRackId: copy.home_rack_id,
        expectedRackNumber: copy.expected_rack_number,
        actualRackId: scannedRack.rack_id,
        actualRackNumber: scannedRack.rack_number
      };
    }

    return {
      isWrongRack: false,
      message: `Copy ${copy.barcode} placed correctly on Rack ${scannedRack.rack_number}.`,
      expectedRackId: copy.home_rack_id,
      actualRackId: scannedRack.rack_id
    };
  }
}

module.exports = AlertService;
