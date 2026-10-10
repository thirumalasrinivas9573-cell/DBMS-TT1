const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/notifications
 * Retrieve notifications for the logged-in user (FR-18, Section 9.7, Section 12)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT 
        notification_id,
        user_id,
        transaction_id,
        type,
        message,
        sent_at,
        status
      FROM notification
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT 50
    `, [req.user.user_id]);

    const unreadCount = rows.filter(n => n.status === 'UNREAD').length;

    return res.json({
      success: true,
      unread_count: unreadCount,
      total_count: rows.length,
      notifications: rows
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving notifications.' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as READ
 */
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    await query(
      "UPDATE notification SET status = 'READ' WHERE notification_id = ? AND user_id = ?",
      [notifId, req.user.user_id]
    );

    return res.json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating notification.' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications of current user as READ
 */
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await query(
      "UPDATE notification SET status = 'READ' WHERE user_id = ?",
      [req.user.user_id]
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating notifications.' });
  }
});

module.exports = router;
