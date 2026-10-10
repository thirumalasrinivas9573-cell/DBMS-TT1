-- ============================================================================
-- Smart, Connected Multi-Library Book Tracking & Discovery System
-- Seed Data
-- ============================================================================

-- Disable FK checks during seed reload
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE notification;
TRUNCATE TABLE transfer_request;
TRUNCATE TABLE borrow_transaction;
TRUNCATE TABLE book_movement;
TRUNCATE TABLE book_copy;
TRUNCATE TABLE reading_table;
TRUNCATE TABLE rack;
TRUNCATE TABLE book;
TRUNCATE TABLE category;
TRUNCATE TABLE publisher;
TRUNCATE TABLE author;
TRUNCATE TABLE user;
TRUNCATE TABLE library;
TRUNCATE TABLE settings;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. SETTINGS
-- ----------------------------------------------------------------------------
INSERT INTO settings (setting_key, setting_value, description) VALUES
('rate_per_km', 2.00, 'Inter-library book transit charge per kilometer in INR'),
('deposit_amount', 500.00, 'Standard security deposit required per borrowed book copy in INR'),
('late_fee_per_day', 5.00, 'Late return fine per day past due date in INR');

-- ----------------------------------------------------------------------------
-- 2. LIBRARIES (3 branches in Hyderabad with verified geographic coordinates)
-- ----------------------------------------------------------------------------
INSERT INTO library (library_id, library_name, address, phone, email, latitude, longitude) VALUES
(1, 'Central Library - Abids', 'Gunfoundry, Abids, Hyderabad, Telangana 500001', '040-23201234', 'central@hydlib.org', 17.391600, 78.473800),
(2, 'Tech Hub Library - HITEC City', 'Cyber Towers Road, HITEC City, Hyderabad, Telangana 500081', '040-23114567', 'techhub@hydlib.org', 17.450400, 78.380800),
(3, 'Heritage Library - Secunderabad', 'Rashtrapati Road, Secunderabad, Telangana 500003', '040-27809876', 'heritage@hydlib.org', 17.441100, 78.501500);

-- ----------------------------------------------------------------------------
-- 3. USERS (1 Admin, 2 Librarians, 5 Members)
-- Passwords:
-- admin@hydlib.org -> admin123
-- librarian1@hydlib.org / librarian2@hydlib.org -> lib123
-- members -> member123
-- ----------------------------------------------------------------------------
INSERT INTO user (user_id, name, email, phone, address, password_hash, role, library_id) VALUES
-- Admin
(1, 'System Administrator', 'admin@hydlib.org', '9848011223', 'HQ Library Board, Secretariat, Hyderabad', '$2b$10$yTe0xIMXKY7ajVTkzV2iTedNb662Fb64JwfIvkTRl3p9MPfHEwwcu', 'ADMIN', NULL),

-- Librarians (assigned to specific branches)
(2, 'K. S. Narayana (Central)', 'librarian1@hydlib.org', '9848022334', 'Abids Staff Quarters, Hyderabad', '$2b$10$m9kSO.0Fk89I5LHMNYOjLuwasT6.oFKZmg2BatD60vvaKdq8/gUQy', 'LIBRARIAN', 1),
(3, 'V. Lakshmi (HITEC City)', 'librarian2@hydlib.org', '9848033445', 'Madhapur Lake View, Hyderabad', '$2b$10$m9kSO.0Fk89I5LHMNYOjLuwasT6.oFKZmg2BatD60vvaKdq8/gUQy', 'LIBRARIAN', 2),

-- Members
(4, 'D. Srinivas', 'srinivas@student.edu', '9123456780', 'Hostel Block A, AIML Dept, Hyderabad', '$2b$10$EJXQyxigwXDN4MIZdSyEAunb0iFKKLvE7/vzrkabC2.YS/E/pvzPe', 'MEMBER', NULL),
(5, 'Ch. Sashank', 'sashank@student.edu', '9123456781', 'Kukatpally Housing Board, Hyderabad', '$2b$10$EJXQyxigwXDN4MIZdSyEAunb0iFKKLvE7/vzrkabC2.YS/E/pvzPe', 'MEMBER', NULL),
(6, 'T. Praveen', 'praveen@student.edu', '9123456782', 'Dilsukhnagar, Hyderabad', '$2b$10$EJXQyxigwXDN4MIZdSyEAunb0iFKKLvE7/vzrkabC2.YS/E/pvzPe', 'MEMBER', NULL),
(7, 'Priya Reddy', 'priya@reader.org', '9123456783', 'Banjara Hills Road No 12, Hyderabad', '$2b$10$EJXQyxigwXDN4MIZdSyEAunb0iFKKLvE7/vzrkabC2.YS/E/pvzPe', 'MEMBER', NULL),
(8, 'Rahul Varma', 'rahul@reader.org', '9123456784', 'Gachibowli Financial District, Hyderabad', '$2b$10$EJXQyxigwXDN4MIZdSyEAunb0iFKKLvE7/vzrkabC2.YS/E/pvzPe', 'MEMBER', NULL);

-- ----------------------------------------------------------------------------
-- 4. AUTHORS (12 authors)
-- ----------------------------------------------------------------------------
INSERT INTO author (author_id, author_name) VALUES
(1, 'James Clear'),
(2, 'Stuart Russell & Peter Norvig'),
(3, 'Ian Goodfellow, Yoshua Bengio & Aaron Courville'),
(4, 'Martin Fowler'),
(5, 'Robert C. Martin'),
(6, 'Andrew Ng'),
(7, 'Eric Evans'),
(8, 'Donald E. Knuth'),
(9, 'Aurélien Géron'),
(10, 'Abraham Silberschatz'),
(11, 'Martin Kleppmann'),
(12, 'Thomas H. Cormen, Charles Leiserson, Ronald Rivest & Clifford Stein');

-- ----------------------------------------------------------------------------
-- 5. PUBLISHERS
-- ----------------------------------------------------------------------------
INSERT INTO publisher (publisher_id, publisher_name) VALUES
(1, 'O''Reilly Media'),
(2, 'MIT Press'),
(3, 'Pearson Education'),
(4, 'Addison-Wesley Professional'),
(5, 'Penguin Random House'),
(6, 'McGraw-Hill Education');

-- ----------------------------------------------------------------------------
-- 6. CATEGORIES (including Machine Learning)
-- ----------------------------------------------------------------------------
INSERT INTO category (category_id, category_name) VALUES
(1, 'Machine Learning'),
(2, 'Artificial Intelligence'),
(3, 'Software Engineering'),
(4, 'Computer Science'),
(5, 'Database Systems'),
(6, 'Self-Help');

-- ----------------------------------------------------------------------------
-- 7. BOOKS (25 titles across categories)
-- ----------------------------------------------------------------------------
INSERT INTO book (book_id, author_id, title, isbn, publication_year, publisher_id, category_id) VALUES
-- Machine Learning
(1, 9, 'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow', '978-1492032649', 2019, 1, 1),
(2, 3, 'Deep Learning', '978-0262035613', 2016, 2, 1),
(3, 6, 'Machine Learning Yearning', '978-0999990001', 2018, 2, 1),
(4, 9, 'Practical Machine Learning with Python', '978-1484232064', 2020, 1, 1),

-- Artificial Intelligence
(5, 2, 'Artificial Intelligence: A Modern Approach', '978-0134610993', 2020, 3, 2),
(6, 2, 'Human Compatible: Artificial Intelligence and the Problem of Control', '978-0525558613', 2019, 5, 2),
(7, 3, 'Generative Deep Learning', '978-1492041948', 2021, 1, 2),
(8, 6, 'AI for Everyone: Principles and Practice', '978-0137788990', 2022, 3, 2),

-- Software Engineering
(9, 5, 'Clean Code: A Handbook of Agile Software Craftsmanship', '978-0132350884', 2008, 3, 3),
(10, 4, 'Refactoring: Improving the Design of Existing Code', '978-0134757599', 2018, 4, 3),
(11, 7, 'Domain-Driven Design: Tackling Complexity in the Heart of Software', '978-0321125217', 2003, 4, 3),
(12, 5, 'Clean Architecture: A Craftsman''s Guide to Software Structure', '978-0134494166', 2017, 3, 3),
(13, 4, 'Patterns of Enterprise Application Architecture', '978-0321127426', 2002, 4, 3),
(14, 5, 'The Clean Coder: A Code of Conduct for Professional Programmers', '978-0137081073', 2011, 3, 3),

-- Computer Science & Algorithms
(15, 12, 'Introduction to Algorithms (CLRS)', '978-0262046305', 2022, 2, 4),
(16, 8, 'The Art of Computer Programming, Volume 1: Fundamental Algorithms', '978-0201896831', 1997, 4, 4),
(17, 8, 'The Art of Computer Programming, Volume 2: Seminumerical Algorithms', '978-0201896848', 1997, 4, 4),
(18, 12, 'Algorithms Unlocked', '978-0262518802', 2013, 2, 4),

-- Database Systems
(19, 10, 'Database System Concepts', '978-0078022159', 2019, 6, 5),
(20, 11, 'Designing Data-Intensive Applications', '978-1449373320', 2017, 1, 5),
(21, 10, 'Operating System Concepts', '978-1119800361', 2021, 3, 5),
(22, 11, 'Streaming Systems: The What, Where, When, and How of Large-Scale Data', '978-1491983874', 2018, 1, 5),

-- Self-Help
(23, 1, 'Atomic Habits: An Easy & Proven Way to Build Good Habits', '978-0735211292', 2018, 5, 6),
(24, 1, 'Transform Your Habits', '978-0735299990', 2020, 5, 6),
(25, 1, 'The Clear Habit Journal', '978-0735288880', 2019, 5, 6);

-- ----------------------------------------------------------------------------
-- 8. RACKS (5 racks per library branch)
-- ----------------------------------------------------------------------------
INSERT INTO rack (rack_id, library_id, rack_number, category) VALUES
-- Library 1 (Central)
(1, 1, 'R01', 'Machine Learning'),
(2, 1, 'R02', 'Artificial Intelligence'),
(3, 1, 'R03', 'Software Engineering'),
(4, 1, 'R04', 'Computer Science & Algorithms'),
(5, 1, 'R05', 'Database Systems & Self-Help'),

-- Library 2 (Tech Hub)
(6, 2, 'R01', 'Machine Learning'),
(7, 2, 'R02', 'Artificial Intelligence'),
(8, 2, 'R03', 'Software Engineering'),
(9, 2, 'R04', 'Computer Science & Algorithms'),
(10, 2, 'R05', 'Database Systems & Self-Help'),

-- Library 3 (Heritage)
(11, 3, 'R01', 'Machine Learning'),
(12, 3, 'R02', 'Artificial Intelligence'),
(13, 3, 'R03', 'Software Engineering'),
(14, 3, 'R04', 'Computer Science & Algorithms'),
(15, 3, 'R05', 'Database Systems & Self-Help'),

-- TC-03 / TC-04 Dedicated Racks (Central Library)
(16, 1, 'R12', 'General Reference & Self-Help'),
(17, 1, 'R18', 'Archives & Special Collections');

-- ----------------------------------------------------------------------------
-- 9. READING TABLES (4 tables per library branch)
-- ----------------------------------------------------------------------------
INSERT INTO reading_table (table_id, library_id, table_number, area_name) VALUES
-- Library 1
(1, 1, 'T01', 'Quiet Study Hall - Ground Floor'),
(2, 1, 'T02', 'Quiet Study Hall - Ground Floor'),
(3, 1, 'T03', 'General Reading Bay - 1st Floor'),
(4, 1, 'T04', 'Discussion Alcove - 1st Floor'),

-- Library 2
(5, 2, 'T01', 'Open Tech Workspace - Wing A'),
(6, 2, 'T02', 'Open Tech Workspace - Wing A'),
(7, 2, 'T03', 'AI Research Pod - Wing B'),
(8, 2, 'T04', 'Terrace Reading Zone'),

-- Library 3
(9, 3, 'T01', 'Main Heritage Hall'),
(10, 3, 'T02', 'Reference Archive Area'),
(11, 3, 'T03', 'Periodicals Section'),
(12, 3, 'T04', 'Quiet Study Room');

-- ----------------------------------------------------------------------------
-- 10. BOOK COPIES (65+ copies distributed across libraries)
-- Barcode format: LIB-A-BC10xx, LIB-B-BC20xx, LIB-C-BC30xx
-- ----------------------------------------------------------------------------
INSERT INTO book_copy (copy_id, book_id, library_id, barcode, status, current_location_type, current_location_id, home_rack_id) VALUES
-- Library 1 Copies (25 copies)
(1, 1, 1, 'LIB-A-BC1001', 'AVAILABLE', 'RACK', 1, 1),
(2, 1, 1, 'LIB-A-BC1002', 'AVAILABLE', 'RACK', 1, 1),
(3, 2, 1, 'LIB-A-BC1003', 'AVAILABLE', 'RACK', 1, 1),
(4, 2, 1, 'LIB-A-BC1004', 'READING', 'TABLE', 1, 1),
(5, 2, 1, 'LIB-A-BC1005', 'AVAILABLE', 'RACK', 5, 1), -- Misplaced copy: home is R01, currently on R05!
(6, 3, 1, 'LIB-A-BC1006', 'AVAILABLE', 'RACK', 1, 1),
(7, 4, 1, 'LIB-A-BC1007', 'AVAILABLE', 'RACK', 1, 1),
(8, 5, 1, 'LIB-A-BC1008', 'AVAILABLE', 'RACK', 2, 2),
(9, 5, 1, 'LIB-A-BC1009', 'BORROWED', 'NONE', NULL, 2), -- Borrowed by member 4
(10, 6, 1, 'LIB-A-BC1010', 'AVAILABLE', 'RACK', 2, 2),
(11, 7, 1, 'LIB-A-BC1011', 'AVAILABLE', 'RACK', 2, 2),
(12, 8, 1, 'LIB-A-BC1012', 'AVAILABLE', 'RACK', 2, 2),
(13, 9, 1, 'LIB-A-BC1013', 'AVAILABLE', 'RACK', 3, 3),
(14, 9, 1, 'LIB-A-BC1014', 'BORROWED', 'NONE', NULL, 3), -- Borrowed by member 5 (overdue)
(15, 10, 1, 'LIB-A-BC1015', 'AVAILABLE', 'RACK', 3, 3),
(16, 11, 1, 'LIB-A-BC1016', 'AVAILABLE', 'RACK', 3, 3),
(17, 12, 1, 'LIB-A-BC1017', 'AVAILABLE', 'RACK', 3, 3),
(18, 15, 1, 'LIB-A-BC1018', 'AVAILABLE', 'RACK', 4, 4),
(19, 16, 1, 'LIB-A-BC1019', 'AVAILABLE', 'RACK', 4, 4),
(20, 19, 1, 'LIB-A-BC1020', 'AVAILABLE', 'RACK', 5, 5),
(21, 20, 1, 'LIB-A-BC1021', 'AVAILABLE', 'RACK', 5, 5),
(22, 23, 1, 'LIB-A-BC1022', 'AVAILABLE', 'RACK', 5, 5),
(23, 23, 1, 'LIB-A-BC1023', 'AVAILABLE', 'RACK', 1, 5), -- Misplaced copy: Atomic Habits home is R05, placed on R01!
(24, 24, 1, 'LIB-A-BC1024', 'AVAILABLE', 'RACK', 5, 5),
(25, 25, 1, 'LIB-A-BC1025', 'IN_TRANSIT', 'NONE', NULL, 5), -- In transit for transfer

-- Library 2 Copies (23 copies)
(26, 1, 2, 'LIB-B-BC2001', 'AVAILABLE', 'RACK', 6, 6),
(27, 2, 2, 'LIB-B-BC2002', 'AVAILABLE', 'RACK', 6, 6),
(28, 2, 2, 'LIB-B-BC2003', 'AVAILABLE', 'RACK', 6, 6),
(29, 2, 2, 'LIB-B-BC2004', 'AVAILABLE', 'RACK', 6, 6),
(30, 3, 2, 'LIB-B-BC2005', 'AVAILABLE', 'RACK', 6, 6),
(31, 5, 2, 'LIB-B-BC2006', 'AVAILABLE', 'RACK', 7, 7),
(32, 6, 2, 'LIB-B-BC2007', 'READING', 'TABLE', 5, 7),
(33, 7, 2, 'LIB-B-BC2008', 'AVAILABLE', 'RACK', 7, 7),
(34, 8, 2, 'LIB-B-BC2009', 'AVAILABLE', 'RACK', 7, 7),
(35, 9, 2, 'LIB-B-BC2010', 'AVAILABLE', 'RACK', 8, 8),
(36, 10, 2, 'LIB-B-BC2011', 'AVAILABLE', 'RACK', 8, 8),
(37, 10, 2, 'LIB-B-BC2012', 'AVAILABLE', 'RACK', 8, 8),
(38, 11, 2, 'LIB-B-BC2013', 'AVAILABLE', 'RACK', 8, 8),
(39, 12, 2, 'LIB-B-BC2014', 'AVAILABLE', 'RACK', 8, 8),
(40, 13, 2, 'LIB-B-BC2015', 'AVAILABLE', 'RACK', 8, 8),
(41, 15, 2, 'LIB-B-BC2016', 'AVAILABLE', 'RACK', 9, 9),
(42, 17, 2, 'LIB-B-BC2017', 'AVAILABLE', 'RACK', 9, 9),
(43, 19, 2, 'LIB-B-BC2018', 'AVAILABLE', 'RACK', 10, 10),
(44, 20, 2, 'LIB-B-BC2019', 'AVAILABLE', 'RACK', 10, 10),
(45, 20, 2, 'LIB-B-BC2020', 'BORROWED', 'NONE', NULL, 10), -- Borrowed by member 6
(46, 23, 2, 'LIB-B-BC2021', 'AVAILABLE', 'RACK', 10, 10),
(47, 23, 2, 'LIB-B-BC2022', 'AVAILABLE', 'RACK', 10, 10),
(48, 23, 2, 'LIB-B-BC2023', 'AVAILABLE', 'RACK', 10, 10),

-- Library 3 Copies (18 copies)
(49, 1, 3, 'LIB-C-BC3001', 'AVAILABLE', 'RACK', 11, 11),
(50, 2, 3, 'LIB-C-BC3002', 'AVAILABLE', 'RACK', 11, 11),
(51, 3, 3, 'LIB-C-BC3003', 'AVAILABLE', 'RACK', 11, 11),
(52, 4, 3, 'LIB-C-BC3004', 'AVAILABLE', 'RACK', 11, 11),
(53, 5, 3, 'LIB-C-BC3005', 'AVAILABLE', 'RACK', 12, 12),
(54, 8, 3, 'LIB-C-BC3006', 'AVAILABLE', 'RACK', 12, 12),
(55, 9, 3, 'LIB-C-BC3007', 'AVAILABLE', 'RACK', 13, 13),
(56, 10, 3, 'LIB-C-BC3008', 'AVAILABLE', 'RACK', 13, 13),
(57, 12, 3, 'LIB-C-BC3009', 'AVAILABLE', 'RACK', 13, 13),
(58, 14, 3, 'LIB-C-BC3010', 'AVAILABLE', 'RACK', 13, 13),
(59, 15, 3, 'LIB-C-BC3011', 'AVAILABLE', 'RACK', 14, 14),
(60, 18, 3, 'LIB-C-BC3012', 'AVAILABLE', 'RACK', 14, 14),
(61, 19, 3, 'LIB-C-BC3013', 'AVAILABLE', 'RACK', 15, 15),
(62, 20, 3, 'LIB-C-BC3014', 'AVAILABLE', 'RACK', 15, 15),
(63, 21, 3, 'LIB-C-BC3015', 'AVAILABLE', 'RACK', 15, 15),
(64, 22, 3, 'LIB-C-BC3016', 'AVAILABLE', 'RACK', 15, 15),
(65, 23, 3, 'LIB-C-BC3017', 'AVAILABLE', 'RACK', 15, 15),
(66, 25, 3, 'LIB-C-BC3018', 'AVAILABLE', 'RACK', 15, 15),
-- TC-03 / TC-04 Dedicated Copy for literal barcode testing
(67, 23, 1, 'BC-1023', 'AVAILABLE', 'RACK', 16, 16);

-- ----------------------------------------------------------------------------
-- 11. BOOK MOVEMENTS (Initial audit log entries)
-- ----------------------------------------------------------------------------
INSERT INTO book_movement (movement_id, copy_id, from_location_type, from_location_id, to_location_type, to_location_id, user_id, scan_time, movement_type) VALUES
(1, 1, 'NONE', NULL, 'RACK', 1, 2, DATE_SUB(NOW(), INTERVAL 10 DAY), 'PLACED_RACK'),
(2, 4, 'RACK', 1, 'TABLE', 1, 2, DATE_SUB(NOW(), INTERVAL 2 HOUR), 'PLACED_TABLE'),
(3, 5, 'RACK', 1, 'RACK', 5, 2, DATE_SUB(NOW(), INTERVAL 1 DAY), 'PLACED_RACK'), -- Wrong rack placement logged
(4, 9, 'RACK', 2, 'NONE', NULL, 2, DATE_SUB(NOW(), INTERVAL 5 DAY), 'ISSUED'),
(5, 14, 'RACK', 3, 'NONE', NULL, 2, DATE_SUB(NOW(), INTERVAL 25 DAY), 'ISSUED'),
(6, 23, 'RACK', 5, 'RACK', 1, 2, DATE_SUB(NOW(), INTERVAL 4 HOUR), 'PLACED_RACK'), -- Atomic Habits wrong rack placement
(7, 25, 'RACK', 5, 'NONE', NULL, 2, DATE_SUB(NOW(), INTERVAL 6 HOUR), 'TRANSFERRED'),
(8, 32, 'RACK', 7, 'TABLE', 5, 3, DATE_SUB(NOW(), INTERVAL 1 HOUR), 'PLACED_TABLE'),
(9, 45, 'RACK', 10, 'NONE', NULL, 3, DATE_SUB(NOW(), INTERVAL 3 DAY), 'ISSUED');

-- ----------------------------------------------------------------------------
-- 12. BORROW TRANSACTIONS (Active, Overdue, Returned, Returned Alternate)
-- ----------------------------------------------------------------------------
INSERT INTO borrow_transaction (transaction_id, copy_id, user_id, issue_library_id, return_library_id, issue_date, due_date, return_date, deposit_amount, late_fee, transfer_distance_km, transfer_charge, refund_amount, status) VALUES
-- Transaction 1: Active on-time loan
(1, 9, 4, 1, NULL, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 9 DAY), NULL, 500.00, 0.00, 0.00, 0.00, NULL, 'ISSUED'),

-- Transaction 2: Overdue loan (issued 25 days ago, due 11 days ago)
(2, 14, 5, 1, NULL, DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY), NULL, 500.00, 0.00, 0.00, 0.00, NULL, 'ISSUED'),

-- Transaction 3: Active loan at Library 2
(3, 45, 6, 2, NULL, DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 11 DAY), NULL, 500.00, 0.00, 0.00, 0.00, NULL, 'ISSUED'),

-- Transaction 4: Returned on time at the same library (Central)
(4, 2, 7, 1, 1, DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY), 500.00, 0.00, 0.00, 0.00, 500.00, 'RETURNED'),

-- Transaction 5: Returned at alternate library (Borrowed at Central, returned at HITEC City ~14.1 km)
-- Rate ₹2/km -> transfer charge ₹28.20, deposit ₹500, refund ₹471.80
(5, 26, 8, 1, 2, DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY), 500.00, 0.00, 14.10, 28.20, 471.80, 'RETURNED_ALT_LIBRARY');

-- ----------------------------------------------------------------------------
-- 13. TRANSFER REQUESTS (Inter-library stock balancing)
-- ----------------------------------------------------------------------------
INSERT INTO transfer_request (transfer_id, copy_id, source_library_id, destination_library_id, requested_by, request_date, status) VALUES
-- PENDING request
(1, 20, 1, 2, 3, CURDATE(), 'PENDING'),

-- IN_TRANSIT request
(2, 25, 1, 3, 2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'IN_TRANSIT'),

-- RECEIVED request (Completed earlier)
(3, 49, 1, 3, 2, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'RECEIVED');

-- ----------------------------------------------------------------------------
-- 14. NOTIFICATIONS
-- ----------------------------------------------------------------------------
INSERT INTO notification (notification_id, user_id, transaction_id, type, message, sent_at, status) VALUES
-- Wrong rack alerts for librarians
(1, 2, NULL, 'WRONG_RACK', 'Atomic Habits — Copy LIB-A-BC1023 has been placed in the wrong rack (Rack R01 instead of expected R05).', DATE_SUB(NOW(), INTERVAL 4 HOUR), 'UNREAD'),
(2, 2, NULL, 'WRONG_RACK', 'Deep Learning — Copy LIB-A-BC1005 has been placed in the wrong rack (Rack R05 instead of expected R01).', DATE_SUB(NOW(), INTERVAL 1 DAY), 'READ'),

-- Due reminders and overdue alerts for members
(3, 4, 1, 'DUE_REMINDER', CONCAT('Your borrowed book "Artificial Intelligence: A Modern Approach" is due on ', DATE_ADD(CURDATE(), INTERVAL 9 DAY), '. Please return or renew on time.'), DATE_SUB(NOW(), INTERVAL 1 DAY), 'UNREAD'),
(4, 5, 2, 'OVERDUE', 'URGENT: Your loan for "Clean Code" is 11 days overdue. Please return immediately to stop daily late fees.', DATE_SUB(NOW(), INTERVAL 2 DAY), 'UNREAD'),

-- Alternate return confirmation
(5, 8, 5, 'RETURN_CONFIRMATION', 'Return processed at Tech Hub Library. Transit charge: ₹28.20. Refund of ₹471.80 issued from deposit.', DATE_SUB(NOW(), INTERVAL 2 DAY), 'READ');
