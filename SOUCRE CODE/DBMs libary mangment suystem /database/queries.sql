-- ============================================================================
-- Smart, Connected Multi-Library Book Tracking & Discovery System
-- Demonstration Queries (JOIN, Aggregate, GROUP BY, Analytical)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. JOIN QUERIES
-- ----------------------------------------------------------------------------

-- 1.1 Multi-Table Catalog Search with Author, Category, and Publisher
SELECT 
    b.book_id,
    b.title,
    a.author_name,
    c.category_name,
    p.publisher_name,
    b.isbn,
    b.publication_year
FROM book b
JOIN author a     ON a.author_id = b.author_id
LEFT JOIN category c  ON c.category_id = b.category_id
LEFT JOIN publisher p ON p.publisher_id = b.publisher_id
WHERE b.title LIKE '%Learning%' 
   OR a.author_name LIKE '%Ng%' 
   OR c.category_name = 'Machine Learning'
ORDER BY b.title;

-- 1.2 Full Physical Copy Audit Trail (Copy Tracker Timeline)
SELECT 
    bc.barcode,
    b.title,
    bm.scan_time,
    bm.movement_type,
    bm.from_location_type,
    bm.from_location_id,
    bm.to_location_type,
    bm.to_location_id,
    u.name AS scanned_by_user,
    u.role AS user_role
FROM book_movement bm
JOIN book_copy bc ON bc.copy_id = bm.copy_id
JOIN book b       ON b.book_id  = bc.book_id
LEFT JOIN user u  ON u.user_id  = bm.user_id
WHERE bc.barcode = 'LIB-A-BC1001'
ORDER BY bm.scan_time ASC;

-- 1.3 Active Loans with Member and Library Branch Details
SELECT 
    bt.transaction_id,
    u.name AS member_name,
    u.email AS member_email,
    b.title AS book_title,
    bc.barcode,
    l.library_name AS issue_branch,
    bt.issue_date,
    bt.due_date,
    bt.deposit_amount,
    bt.status
FROM borrow_transaction bt
JOIN user u        ON u.user_id = bt.user_id
JOIN book_copy bc  ON bc.copy_id = bt.copy_id
JOIN book b        ON b.book_id = bc.book_id
JOIN library l     ON l.library_id = bt.issue_library_id
WHERE bt.status = 'ISSUED'
ORDER BY bt.due_date ASC;

-- ----------------------------------------------------------------------------
-- 2. AGGREGATE & GROUP BY QUERIES
-- ----------------------------------------------------------------------------

-- 2.1 Available Stock per Library with Haversine Distance (User at Banjara Hills: 17.4156, 78.4357)
SELECT 
    l.library_id,
    l.library_name,
    l.address,
    COUNT(bc.copy_id) AS available_copies,
    ROUND(6371 * ACOS(LEAST(1.0,
        COS(RADIANS(17.4156)) * COS(RADIANS(l.latitude)) *
        COS(RADIANS(l.longitude) - RADIANS(78.4357)) +
        SIN(RADIANS(17.4156)) * SIN(RADIANS(l.latitude))
    )), 2) AS distance_km
FROM library l
JOIN book_copy bc ON bc.library_id = l.library_id
JOIN book b       ON b.book_id = bc.book_id
WHERE b.title = 'Deep Learning' 
  AND bc.status = 'AVAILABLE'
GROUP BY l.library_id, l.library_name, l.address, l.latitude, l.longitude
ORDER BY distance_km ASC;

-- 2.2 Financial Summary: Revenue and Deductions by Charge Type
SELECT 
    COUNT(bt.transaction_id) AS total_transactions,
    SUM(bt.deposit_amount) AS total_deposits_collected,
    SUM(bt.late_fee) AS total_late_fees_collected,
    SUM(bt.transfer_charge) AS total_transfer_charges_collected,
    SUM(COALESCE(bt.refund_amount, 0)) AS total_refunded_to_members,
    SUM(bt.late_fee + bt.transfer_charge) AS net_library_revenue
FROM borrow_transaction bt
WHERE bt.status IN ('RETURNED', 'RETURNED_ALT_LIBRARY');

-- 2.3 Most Frequently Moved Physical Copies (Handling / Circulation Hotspots)
SELECT 
    bc.copy_id,
    bc.barcode,
    b.title,
    l.library_name AS current_library,
    COUNT(bm.movement_id) AS total_movements,
    MAX(bm.scan_time) AS last_scanned_at
FROM book_copy bc
JOIN book b          ON b.book_id = bc.book_id
JOIN library l       ON l.library_id = bc.library_id
JOIN book_movement bm ON bm.copy_id = bc.copy_id
GROUP BY bc.copy_id, bc.barcode, b.title, l.library_name
ORDER BY total_movements DESC, last_scanned_at DESC
LIMIT 10;

-- 2.4 Stock Distribution Across Subject Categories by Library
SELECT 
    l.library_name,
    c.category_name,
    COUNT(bc.copy_id) AS total_copies,
    SUM(CASE WHEN bc.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_count,
    SUM(CASE WHEN bc.status = 'BORROWED' THEN 1 ELSE 0 END) AS borrowed_count
FROM library l
JOIN book_copy bc ON bc.library_id = l.library_id
JOIN book b       ON b.book_id = bc.book_id
JOIN category c   ON c.category_id = b.category_id
GROUP BY l.library_name, c.category_name
ORDER BY l.library_name, total_copies DESC;

-- 2.5 Inter-Library Transfer Summary by Status and Branch Pairs
SELECT 
    sl.library_name AS source_library,
    dl.library_name AS destination_library,
    tr.status,
    COUNT(tr.transfer_id) AS transfer_count
FROM transfer_request tr
JOIN library sl ON sl.library_id = tr.source_library_id
JOIN library dl ON dl.library_id = tr.destination_library_id
GROUP BY sl.library_name, dl.library_name, tr.status
ORDER BY sl.library_name, transfer_count DESC;
