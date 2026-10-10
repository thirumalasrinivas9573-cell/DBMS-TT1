-- ============================================================================
-- Smart, Connected Multi-Library Book Tracking & Discovery System
-- Database Schema (DDL)
-- ============================================================================

-- Drop tables in reverse dependency order if recreating
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS transfer_request;
DROP TABLE IF EXISTS borrow_transaction;
DROP TABLE IF EXISTS book_movement;
DROP TABLE IF EXISTS book_copy;
DROP TABLE IF EXISTS reading_table;
DROP TABLE IF EXISTS rack;
DROP TABLE IF EXISTS book;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS publisher;
DROP TABLE IF EXISTS author;
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS library;
DROP TABLE IF EXISTS settings;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. LIBRARY
CREATE TABLE library (
    library_id   INT AUTO_INCREMENT PRIMARY KEY,
    library_name VARCHAR(100) NOT NULL,
    address      VARCHAR(255),
    phone        VARCHAR(15),
    email        VARCHAR(120),
    latitude     DECIMAL(9,6) NOT NULL CHECK (latitude BETWEEN -90.000000 AND 90.000000),
    longitude    DECIMAL(9,6) NOT NULL CHECK (longitude BETWEEN -180.000000 AND 180.000000),
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. USER
CREATE TABLE user (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    phone         VARCHAR(15),
    address       VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('MEMBER', 'LIBRARIAN', 'ADMIN') NOT NULL DEFAULT 'MEMBER',
    library_id    INT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_library FOREIGN KEY (library_id) 
        REFERENCES library (library_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. AUTHOR
CREATE TABLE author (
    author_id   INT AUTO_INCREMENT PRIMARY KEY,
    author_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. PUBLISHER (Supporting lookup)
CREATE TABLE publisher (
    publisher_id   INT AUTO_INCREMENT PRIMARY KEY,
    publisher_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. CATEGORY (Supporting lookup)
CREATE TABLE category (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. BOOK (One row per title)
CREATE TABLE book (
    book_id          INT AUTO_INCREMENT PRIMARY KEY,
    author_id        INT NOT NULL,
    title            VARCHAR(200) NOT NULL,
    isbn             VARCHAR(20) UNIQUE,
    publication_year INT,
    publisher_id     INT NULL,
    category_id      INT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_book_author FOREIGN KEY (author_id) 
        REFERENCES author (author_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_book_publisher FOREIGN KEY (publisher_id) 
        REFERENCES publisher (publisher_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    CONSTRAINT fk_book_category FOREIGN KEY (category_id) 
        REFERENCES category (category_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. RACK
CREATE TABLE rack (
    rack_id     INT AUTO_INCREMENT PRIMARY KEY,
    library_id  INT NOT NULL,
    rack_number VARCHAR(20) NOT NULL,
    category    VARCHAR(60),
    CONSTRAINT fk_rack_library FOREIGN KEY (library_id) 
        REFERENCES library (library_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT uq_rack_library_number UNIQUE (library_id, rack_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. READING_TABLE
CREATE TABLE reading_table (
    table_id     INT AUTO_INCREMENT PRIMARY KEY,
    library_id   INT NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    area_name    VARCHAR(60),
    CONSTRAINT fk_table_library FOREIGN KEY (library_id) 
        REFERENCES library (library_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT uq_table_library_number UNIQUE (library_id, table_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. BOOK_COPY (One row per physical copy)
CREATE TABLE book_copy (
    copy_id               INT AUTO_INCREMENT PRIMARY KEY,
    book_id               INT NOT NULL,
    library_id            INT NOT NULL,
    barcode               VARCHAR(30) NOT NULL UNIQUE,
    status                ENUM('AVAILABLE', 'IN_TRANSIT', 'READING', 'RETURNING', 'BORROWED', 'LOST') 
                          NOT NULL DEFAULT 'AVAILABLE',
    current_location_type ENUM('RACK', 'TABLE', 'NONE') NOT NULL DEFAULT 'NONE',
    current_location_id   INT NULL,
    home_rack_id          INT NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_copy_book FOREIGN KEY (book_id) 
        REFERENCES book (book_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_copy_library FOREIGN KEY (library_id) 
        REFERENCES library (library_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_copy_homerack FOREIGN KEY (home_rack_id) 
        REFERENCES rack (rack_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. BOOK_MOVEMENT (Append-only physical audit log)
CREATE TABLE book_movement (
    movement_id        INT AUTO_INCREMENT PRIMARY KEY,
    copy_id            INT NOT NULL,
    from_location_type ENUM('RACK', 'TABLE', 'NONE') NOT NULL DEFAULT 'NONE',
    from_location_id   INT NULL,
    to_location_type   ENUM('RACK', 'TABLE', 'NONE') NOT NULL DEFAULT 'NONE',
    to_location_id     INT NULL,
    user_id            INT NULL,
    scan_time          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    movement_type      ENUM('PICKED', 'PLACED_TABLE', 'PLACED_RACK', 'ISSUED', 'RETURNED', 'TRANSFERRED') NOT NULL,
    CONSTRAINT fk_movement_copy FOREIGN KEY (copy_id) 
        REFERENCES book_copy (copy_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_movement_user FOREIGN KEY (user_id) 
        REFERENCES user (user_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. BORROW_TRANSACTION (Issue, return, and fee records)
CREATE TABLE borrow_transaction (
    transaction_id       INT AUTO_INCREMENT PRIMARY KEY,
    copy_id              INT NOT NULL,
    user_id              INT NOT NULL,
    issue_library_id     INT NOT NULL,
    return_library_id    INT NULL,
    issue_date           DATE NOT NULL,
    due_date             DATE NOT NULL,
    return_date          DATE NULL,
    deposit_amount       DECIMAL(8,2) NOT NULL DEFAULT 500.00 CHECK (deposit_amount >= 0.00),
    late_fee             DECIMAL(8,2) NOT NULL DEFAULT 0.00 CHECK (late_fee >= 0.00),
    transfer_distance_km DECIMAL(7,2) NOT NULL DEFAULT 0.00 CHECK (transfer_distance_km >= 0.00),
    transfer_charge      DECIMAL(8,2) NOT NULL DEFAULT 0.00 CHECK (transfer_charge >= 0.00),
    refund_amount        DECIMAL(8,2) NULL,
    status               ENUM('ISSUED', 'RETURNED', 'RETURNED_ALT_LIBRARY', 'OVERDUE') NOT NULL DEFAULT 'ISSUED',
    CONSTRAINT chk_due_after_issue CHECK (due_date >= issue_date),
    CONSTRAINT fk_trans_copy FOREIGN KEY (copy_id) 
        REFERENCES book_copy (copy_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_trans_user FOREIGN KEY (user_id) 
        REFERENCES user (user_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_trans_issuelib FOREIGN KEY (issue_library_id) 
        REFERENCES library (library_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_trans_returnlib FOREIGN KEY (return_library_id) 
        REFERENCES library (library_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. TRANSFER_REQUEST (Inter-library stock balance requests)
CREATE TABLE transfer_request (
    transfer_id            INT AUTO_INCREMENT PRIMARY KEY,
    copy_id                INT NOT NULL,
    source_library_id      INT NOT NULL,
    destination_library_id INT NOT NULL,
    requested_by           INT NOT NULL,
    request_date           DATE NOT NULL,
    status                 ENUM('PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    CONSTRAINT chk_diff_libraries CHECK (source_library_id <> destination_library_id),
    CONSTRAINT fk_transfer_copy FOREIGN KEY (copy_id) 
        REFERENCES book_copy (copy_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_sourcelib FOREIGN KEY (source_library_id) 
        REFERENCES library (library_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_destlib FOREIGN KEY (destination_library_id) 
        REFERENCES library (library_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_requester FOREIGN KEY (requested_by) 
        REFERENCES user (user_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. NOTIFICATION
CREATE TABLE notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    transaction_id  INT NULL,
    type            VARCHAR(30) NOT NULL,
    message         VARCHAR(255) NOT NULL,
    sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status          ENUM('UNREAD', 'READ') NOT NULL DEFAULT 'UNREAD',
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) 
        REFERENCES user (user_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_notif_trans FOREIGN KEY (transaction_id) 
        REFERENCES borrow_transaction (transaction_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. SETTINGS (Configurable system rates and thresholds)
CREATE TABLE settings (
    setting_key   VARCHAR(50) PRIMARY KEY,
    setting_value DECIMAL(10,2) NOT NULL,
    description   VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- Indexes (Section 10.6 & 11.1)
-- ============================================================================
CREATE INDEX idx_copy_book_status       ON book_copy (book_id, status);
CREATE INDEX idx_copy_library           ON book_copy (library_id);
CREATE INDEX idx_copy_home_rack         ON book_copy (home_rack_id);
CREATE INDEX idx_book_title             ON book (title);
CREATE INDEX idx_book_author            ON book (author_id);
CREATE INDEX idx_book_category          ON book (category_id);
CREATE INDEX idx_movement_copy          ON book_movement (copy_id);
CREATE INDEX idx_movement_user          ON book_movement (user_id);
CREATE INDEX idx_movement_time          ON book_movement (scan_time);
CREATE INDEX idx_borrow_user_status     ON borrow_transaction (user_id, status);
CREATE INDEX idx_borrow_copy            ON borrow_transaction (copy_id);
CREATE INDEX idx_borrow_due_date        ON borrow_transaction (due_date);
CREATE INDEX idx_transfer_status        ON transfer_request (status);
CREATE INDEX idx_transfer_copy          ON transfer_request (copy_id);
CREATE INDEX idx_notification_user_stat ON notification (user_id, status);
CREATE INDEX idx_user_role              ON user (role);
