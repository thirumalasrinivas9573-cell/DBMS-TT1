const { query } = require('../config/db');

/**
 * Service to manage system settings and compute borrow/return fees
 */
class ChargeService {
  /**
   * Fetches current financial configuration settings from database
   */
  static async getSettings(executor = null) {
    const runQuery = executor ? executor.query.bind(executor) : query;
    const [rows] = await runQuery('SELECT setting_key, setting_value FROM settings');
    
    const settingsMap = {
      rate_per_km: 2.00,
      deposit_amount: 500.00,
      late_fee_per_day: 5.00
    };

    if (rows && rows.length > 0) {
      for (const r of rows) {
        settingsMap[r.setting_key] = parseFloat(r.setting_value);
      }
    }

    return settingsMap;
  }

  /**
   * Calculates late fee based on overdue calendar days
   */
  static calculateLateFee(dueDateStr, returnDateStr, lateFeePerDay) {
    const due = new Date(dueDateStr);
    const ret = returnDateStr ? new Date(returnDateStr) : new Date();
    
    // Normalize to date boundary
    due.setHours(0, 0, 0, 0);
    ret.setHours(0, 0, 0, 0);

    const diffMs = ret.getTime() - due.getTime();
    const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    const lateFee = Math.round(daysOverdue * lateFeePerDay * 100) / 100;
    return {
      daysOverdue,
      lateFee
    };
  }

  /**
   * Calculates transfer/handling fee for alternate library return
   */
  static calculateTransferCharge(distanceKm, ratePerKm) {
    const km = Math.max(0, parseFloat(distanceKm) || 0);
    const rate = parseFloat(ratePerKm) || 0;
    const transferCharge = Math.round(km * rate * 100) / 100;
    return transferCharge;
  }

  /**
   * Calculates net refund amount = deposit - lateFee - transferCharge
   * Per sections 9.5 and 11.6
   */
  static calculateRefund(depositAmount, lateFee, transferCharge) {
    const deposit = parseFloat(depositAmount) || 0;
    const fee = parseFloat(lateFee) || 0;
    const charge = parseFloat(transferCharge) || 0;
    const refund = Math.round((deposit - fee - charge) * 100) / 100;
    return refund;
  }
}

module.exports = ChargeService;
