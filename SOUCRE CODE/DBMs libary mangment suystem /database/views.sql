-- ============================================================================
-- Smart, Connected Multi-Library Book Tracking & Discovery System
-- Database Views
-- ============================================================================

-- 1. v_wrong_rack
-- Identifies physical copies located on a rack different from their assigned home rack
CREATE OR REPLACE VIEW v_wrong_rack AS
SELECT 
    bc.copy_id,
    bc.barcode,
    b.book_id,
    b.title,
    bc.library_id,
    l.library_name,
    bc.home_rack_id AS expected_rack_id,
    hr.rack_number  AS expected_rack,
    bc.current_location_id AS actual_rack_id,
    cr.rack_number  AS actual_rack,
    bc.status
FROM book_copy bc
JOIN book b    ON b.book_id    = bc.book_id
JOIN library l ON l.library_id = bc.library_id
JOIN rack hr   ON hr.rack_id   = bc.home_rack_id
JOIN rack cr   ON bc.current_location_type = 'RACK' AND cr.rack_id = bc.current_location_id
WHERE bc.current_location_id <> bc.home_rack_id;

-- 2. v_library_stock
-- Summarizes total, available, and borrowed copies per title across each library branch
CREATE OR REPLACE VIEW v_library_stock AS
SELECT 
    l.library_id,
    l.library_name,
    b.book_id,
    b.title,
    a.author_name,
    c.category_name,
    COUNT(bc.copy_id) AS total_copies,
    SUM(CASE WHEN bc.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_copies,
    SUM(CASE WHEN bc.status = 'BORROWED' THEN 1 ELSE 0 END) AS borrowed_copies,
    SUM(CASE WHEN bc.status = 'READING' THEN 1 ELSE 0 END) AS reading_copies,
    SUM(CASE WHEN bc.status = 'IN_TRANSIT' THEN 1 ELSE 0 END) AS in_transit_copies,
    SUM(CASE WHEN bc.status = 'RETURNING' THEN 1 ELSE 0 END) AS returning_copies
FROM book_copy bc
JOIN library l ON l.library_id = bc.library_id
JOIN book b    ON b.book_id = bc.book_id
JOIN author a  ON a.author_id = b.author_id
LEFT JOIN category c ON c.category_id = b.category_id
GROUP BY l.library_id, l.library_name, b.book_id, b.title, a.author_name, c.category_name;

-- 3. v_overdue
-- Lists all currently issued loans that have exceeded their due date, including estimated fines
CREATE OR REPLACE VIEW v_overdue AS
SELECT 
    bt.transaction_id,
    bt.copy_id,
    bc.barcode,
    b.title,
    bt.user_id,
    u.name AS member_name,
    u.email AS member_email,
    u.phone AS member_phone,
    bt.issue_library_id,
    il.library_name AS issue_library_name,
    bt.issue_date,
    bt.due_date,
    DATEDIFF(CURDATE(), bt.due_date) AS days_overdue,
    ROUND(DATEDIFF(CURDATE(), bt.due_date) * COALESCE(s.setting_value, 5.00), 2) AS estimated_late_fee
FROM borrow_transaction bt
JOIN book_copy bc ON bc.copy_id = bt.copy_id
JOIN book b ON b.book_id = bc.book_id
JOIN user u ON u.user_id = bt.user_id
JOIN library il ON il.library_id = bt.issue_library_id
LEFT JOIN settings s ON s.setting_key = 'late_fee_per_day'
WHERE bt.status = 'ISSUED' AND bt.due_date < CURDATE();
