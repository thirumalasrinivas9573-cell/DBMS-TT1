const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { haversineDistance, getHaversineSql } = require('../services/distanceService');

/**
 * GET /api/books
 * Search books across title, author, category, ISBN, year, and keywords
 * (FR-09, Section 9.3, Section 11.2)
 */
router.get('/', async (req, res) => {
  try {
    const { q, category, author, year } = req.query;

    let sql = `
      SELECT 
        b.book_id,
        b.title,
        b.isbn,
        b.publication_year,
        a.author_id,
        a.author_name,
        c.category_id,
        c.category_name,
        p.publisher_id,
        p.publisher_name,
        COUNT(bc.copy_id) AS total_copies,
        SUM(CASE WHEN bc.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_copies
      FROM book b
      JOIN author a ON a.author_id = b.author_id
      LEFT JOIN category c ON c.category_id = b.category_id
      LEFT JOIN publisher p ON p.publisher_id = b.publisher_id
      LEFT JOIN book_copy bc ON bc.book_id = b.book_id
      WHERE 1=1
    `;

    const params = [];

    if (q && q.trim()) {
      const rawTerm = q.trim();
      const cleaned = rawTerm.replace(/\b(books|book)\b/gi, '').trim();
      const term1 = `%${rawTerm}%`;
      const term2 = cleaned ? `%${cleaned}%` : term1;

      sql += ` AND (
        b.title LIKE ? 
        OR a.author_name LIKE ? 
        OR b.isbn LIKE ? 
        OR c.category_name LIKE ?
        OR b.title LIKE ?
        OR c.category_name LIKE ?
      )`;
      params.push(term1, term1, term1, term1, term2, term2);
    }

    if (category && category.trim()) {
      sql += ` AND (c.category_name LIKE ? OR c.category_id = ?)`;
      params.push(`%${category.trim()}%`, category.trim());
    }

    if (author && author.trim()) {
      sql += ` AND a.author_name LIKE ?`;
      params.push(`%${author.trim()}%`);
    }

    if (year) {
      sql += ` AND b.publication_year = ?`;
      params.push(parseInt(year, 10));
    }

    sql += `
      GROUP BY 
        b.book_id, b.title, b.isbn, b.publication_year, 
        a.author_id, a.author_name, 
        c.category_id, c.category_name, 
        p.publisher_id, p.publisher_name
      ORDER BY b.title ASC
    `;

    const [books] = await query(sql, params);

    return res.json({
      success: true,
      count: books.length,
      books: books.map(b => ({
        ...b,
        total_copies: Number(b.total_copies || 0),
        available_copies: Number(b.available_copies || 0)
      }))
    });
  } catch (err) {
    console.error('Books search error:', err);
    return res.status(500).json({ success: false, error: 'Server error searching books.' });
  }
});

/**
 * GET /api/books/:id
 * Retrieve details of a specific book including catalog metadata
 */
router.get('/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    if (isNaN(bookId)) {
      return res.status(400).json({ success: false, error: 'Invalid book ID.' });
    }

    const [books] = await query(
      `SELECT 
        b.book_id, b.title, b.isbn, b.publication_year,
        a.author_id, a.author_name,
        c.category_id, c.category_name,
        p.publisher_id, p.publisher_name
       FROM book b
       JOIN author a ON a.author_id = b.author_id
       LEFT JOIN category c ON c.category_id = b.category_id
       LEFT JOIN publisher p ON p.publisher_id = b.publisher_id
       WHERE b.book_id = ?`,
      [bookId]
    );

    if (books.length === 0) {
      return res.status(404).json({ success: false, error: 'Book title not found.' });
    }

    const [copies] = await query(
      `SELECT 
        bc.copy_id, bc.barcode, bc.status, bc.current_location_type, bc.current_location_id,
        l.library_id, l.library_name,
        r.rack_number AS home_rack_number
       FROM book_copy bc
       JOIN library l ON l.library_id = bc.library_id
       LEFT JOIN rack r ON r.rack_id = bc.home_rack_id
       WHERE bc.book_id = ?`,
      [bookId]
    );

    return res.json({
      success: true,
      book: books[0],
      total_copies: copies.length,
      available_copies: copies.filter(c => c.status === 'AVAILABLE').length,
      copies
    });
  } catch (err) {
    console.error('Book details error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving book details.' });
  }
});

/**
 * GET /api/books/:id/availability?lat=&lng=
 * Multi-library availability sorted by Haversine distance (FR-10, FR-11, Section 9.3, Section 11.3)
 */
router.get('/:id/availability', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    if (isNaN(bookId)) {
      return res.status(400).json({ success: false, error: 'Invalid book ID.' });
    }

    // Default to Hyderabad center (17.385044, 78.486671) if lat/lng not provided
    const userLat = req.query.lat !== undefined ? parseFloat(req.query.lat) : 17.385044;
    const userLng = req.query.lng !== undefined ? parseFloat(req.query.lng) : 78.486671;

    // Verify book exists
    const [bookRows] = await query('SELECT book_id, title FROM book WHERE book_id = ?', [bookId]);
    if (bookRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Book not found.' });
    }

    // Query all libraries with copy counts and rack information
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
        SUM(CASE WHEN bc.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_copies,
        GROUP_CONCAT(DISTINCT CASE WHEN bc.status = 'AVAILABLE' THEN r.rack_number ELSE NULL END) AS available_racks
      FROM library l
      LEFT JOIN book_copy bc ON bc.library_id = l.library_id AND bc.book_id = ?
      LEFT JOIN rack r ON r.rack_id = bc.home_rack_id
      GROUP BY l.library_id, l.library_name, l.address, l.phone, l.email, l.latitude, l.longitude
    `, [bookId]);

    // Calculate distance and format response
    const results = libraries.map(lib => {
      const distanceKm = haversineDistance(userLat, userLng, lib.latitude, lib.longitude);
      const availableCount = Number(lib.available_copies || 0);

      return {
        library_id: lib.library_id,
        library_name: lib.library_name,
        address: lib.address,
        phone: lib.phone,
        email: lib.email,
        latitude: parseFloat(lib.latitude),
        longitude: parseFloat(lib.longitude),
        total_copies: Number(lib.total_copies || 0),
        available_copies: availableCount,
        available_racks: lib.available_racks ? lib.available_racks.split(',').filter(Boolean) : [],
        distance_km: distanceKm,
        has_stock: availableCount > 0
      };
    });

    // Sort by distance ascending
    results.sort((a, b) => a.distance_km - b.distance_km);

    // Identify best match (nearest library that HAS stock)
    const bestMatch = results.find(r => r.available_copies > 0) || null;

    return res.json({
      success: true,
      book: bookRows[0],
      user_location: { latitude: userLat, longitude: userLng },
      best_match: bestMatch,
      libraries: results
    });
  } catch (err) {
    console.error('Book availability error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving availability.' });
  }
});

module.exports = router;
