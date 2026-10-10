const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new member
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required fields.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    // Check if email already registered (TC-01)
    const [existing] = await query('SELECT user_id FROM user WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await query(
      `INSERT INTO user (name, email, phone, address, password_hash, role, library_id)
       VALUES (?, ?, ?, ?, ?, 'MEMBER', NULL)`,
      [name.trim(), email.trim().toLowerCase(), phone || null, address || null, passwordHash]
    );

    const userId = result.insertId;
    const userPayload = {
      user_id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'MEMBER',
      library_id: null
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: 'Member registration successful.',
      token,
      user: userPayload
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during registration.'
    });
  }
});

/**
 * POST /api/auth/login
 * Log in and receive JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const [rows] = await query(
      `SELECT user_id, name, email, phone, address, password_hash, role, library_id 
       FROM user WHERE email = ?`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const userPayload = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      library_id: user.library_id
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        ...userPayload,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during login.'
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieve profile of authenticated user
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT u.user_id, u.name, u.email, u.phone, u.address, u.role, u.library_id, l.library_name
       FROM user u
       LEFT JOIN library l ON l.library_id = u.library_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({
      success: true,
      user: rows[0]
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving user profile.' });
  }
});

module.exports = router;
