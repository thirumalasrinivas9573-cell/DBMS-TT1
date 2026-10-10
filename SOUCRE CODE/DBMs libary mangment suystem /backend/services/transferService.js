/**
 * Transfer Request State Machine Service
 * State Machine: PENDING -> APPROVED -> IN_TRANSIT -> RECEIVED, or CANCELLED (only before transit)
 */
class TransferService {
  static VALID_TRANSITIONS = {
    'PENDING': ['APPROVED', 'CANCELLED'],
    'APPROVED': ['IN_TRANSIT', 'CANCELLED'],
    'IN_TRANSIT': ['RECEIVED'],
    'RECEIVED': [],
    'CANCELLED': []
  };

  /**
   * Validates if a transition from currentStatus to newStatus is permissible
   */
  static isValidTransition(currentStatus, newStatus) {
    const allowed = this.VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(newStatus);
  }

  /**
   * Asserts whether a status transition is permitted, throws descriptive error if not
   */
  static validateTransition(currentStatus, newStatus) {
    if (!this.isValidTransition(currentStatus, newStatus)) {
      if (currentStatus === 'IN_TRANSIT' && newStatus === 'CANCELLED') {
        throw new Error('Transfer cannot be CANCELLED once the book copy is already IN_TRANSIT.');
      }
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: [${(this.VALID_TRANSITIONS[currentStatus] || []).join(', ')}]`);
    }
  }
}

module.exports = TransferService;
