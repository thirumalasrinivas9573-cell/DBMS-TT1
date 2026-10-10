
DATABASE MANAGEMENT SYSTEMS

CAPSTONE PROJECT

Smart, Connected Multi-Library

Book Tracking & Discovery System

Website Project Documentation

Submitted by

D. Srinivas (25B11AID13)

Ch. Sashank (26B21AI018)

T. Praveen (25B11AIC12)

Department of Artificial Intelligence and Machine Learning

[College Name]   |   Academic Year [20XX–20XX]


Contents

1. Introduction

2. Problem Statement and Existing System Gap

3. Proposed System

4. Users and Roles

5. Functional Requirements

6. Non-Functional Requirements

7. System Architecture

8. Website Structure (Sitemap and Pages)

9. Core Feature Specifications

10. Database Design

11. Sample SQL Implementation

12. API Design

13. User Interface Design Guidelines

14. Technology Stack

15. Security Considerations

16. Testing Plan

17. Implementation Roadmap

18. Team Responsibilities

19. Limitations and Future Enhancements

20. Conclusion

Appendix A: Glossary


# 1. Introduction

## 1.1 Purpose of this Document

This document describes the design and planned implementation of the web application for the Smart, Connected Multi-Library Book Tracking & Discovery System, developed as the DBMS Capstone Project. It explains what the website does, who uses it, how it is structured, and how it is backed by the relational database designed in Review I.

## 1.2 Project Overview

Conventional library software records a book as a title with a total quantity. Our system gives every physical copy of a book its own unique barcode, a live current location, and a complete movement history, and connects many libraries through one shared database. Members can find the nearest library that has an available copy, borrow in one city and return in another, and librarians can detect misplaced books instantly.

Guiding principle: The website is the interface. The database is the backbone. Every screen in the website reads from or writes to the relational database, which is the single source of truth.

## 1.3 Objectives

Track every physical book copy individually using a barcode.

Record every movement of a copy (rack, reading table, borrower, transfer) as a permanent history.

Detect and alert when a copy is placed in the wrong rack.

Let members search across all libraries and see the nearest library with an available copy.

Support returning a book at a different library from where it was borrowed, with an inter-library transfer charge.

Let librarians balance stock between libraries using transfer requests.

Demonstrate DBMS concepts: ER design, normalization, keys, constraints, joins, aggregates, views, indexes, and transactions.

## 1.4 Scope

In scope: user authentication, catalog management, barcode-based scanning, location tracking, wrong-rack alerts, cross-library search with distance, borrow and return (including alternate-library return), security deposit, late fee and transfer charge tracking, transfer requests between libraries, notifications, and basic reports.

Out of scope (for this project): online payment gateway integration, hardware barcode-scanner drivers, native mobile applications, and e-book lending. These are listed under future enhancements.

## 1.5 Team

| Name | Roll Number | Department |
| --- | --- | --- |
| D. Srinivas | 25B11AID13 | Artificial Intelligence and Machine Learning |
| Ch. Sashank | 26B21AI018 | Artificial Intelligence and Machine Learning |
| T. Praveen | 25B11AIC12 | Artificial Intelligence and Machine Learning |

# 2. Problem Statement and Existing System Gap

## 2.1 The Problem

Once a book leaves its rack, the library loses track of it. A student may take a book from Rack R12, read it at Table T05, and leave it on the wrong rack, or somewhere else entirely. With hundreds or thousands of physical books moving every day, a librarian cannot manually search every rack, table, and reading corner to find one missing copy.

## 2.2 Why a Normal Library System Is Not Enough

| Typical library software | Proposed system |
| --- | --- |
| Book = title + total quantity | Every physical copy has a unique barcode |
| No identity for each physical copy | Live current location, always up to date |
| No record of where a copy is right now | Complete movement history for each copy |
| No visibility once the book leaves the counter | Automatic wrong-rack detection and alerts |
| Single library only, no network view | One database connecting many libraries |

# 3. Proposed System

The system links four things together: a physical book, its unique barcode (for example LIB-A-BC1023), a central database record, and a location. A barcode scan is the event through which the physical world updates the database.

## 3.1 Key Capabilities

| Capability | Description |
| --- | --- |
| Physical tracking | Scanning a copy and a rack/table barcode updates status and location in real time. |
| Wrong-rack detection | The scanned location is compared with the expected location stored in the database; a mismatch raises an alert. |
| Cross-library discovery | Search by title, author, category, ISBN or year; results show which libraries hold available copies and how far they are. |
| Return anywhere | A book borrowed at Library A can be returned at Library B; the system records the transfer distance and charge. |
| Financial tracking | Security deposit, late fee, transfer/handling charge and refund are stored as separate values. |
| Network operations | A librarian can raise a transfer request to move spare copies from one library to another. |
| Notifications | Members and librarians receive alerts for due dates, wrong-rack events, and transfer progress. |

# 4. Users and Roles

The website serves three types of users. Access is enforced by role-based access control.

| Role | Description | Main permissions |
| --- | --- | --- |
| Member (Student / Reader) | A registered library user. | Search books across libraries View availability and distance View own borrowed books and history Request/perform return at another library View notifications |
| Librarian | Staff assigned to one library. | Scan books, racks and reading tables Issue and return books Manage copies, racks, tables of own library View wrong-rack alerts and copy history Raise and update transfer requests |
| Administrator | Manages the whole library network. | Manage libraries, users and librarians Manage catalog (authors, books) Configure rate per km, deposit, late fee View network-wide reports |

# 5. Functional Requirements

| ID | Requirement | Role |
| --- | --- | --- |
| FR-01 | The system shall allow a user to register and log in with email and password. | All |
| FR-02 | The system shall allow the administrator to add, update and delete libraries with address and latitude/longitude. | Admin |
| FR-03 | The system shall maintain a catalog of authors and book titles with ISBN, publisher, category and publication year. | Admin / Librarian |
| FR-04 | The system shall store each physical copy as a separate record with a unique barcode. | Librarian |
| FR-05 | The system shall record racks and reading tables for each library. | Librarian |
| FR-06 | The system shall update a copy's status and current location when its barcode and a location barcode are scanned. | Librarian |
| FR-07 | The system shall log every scan as a BOOK_MOVEMENT record with time, type, and user. | System |
| FR-08 | The system shall raise a wrong-rack alert when the scanned rack differs from the expected rack. | System |
| FR-09 | The system shall let users search books by title, author, category, ISBN, year or keyword. | All |
| FR-10 | The system shall show, for a book, the number of available copies at each library and the distance from the user. | Member |
| FR-11 | The system shall highlight the nearest library with an available copy and the rack where it is kept. | Member |
| FR-12 | The system shall issue a copy to a member, recording issue date, due date and security deposit. | Librarian |
| FR-13 | The system shall allow return at the original library or at a different library. | Librarian |
| FR-14 | For an alternate-library return, the system shall compute the distance and the transfer charge (distance × configured rate). | System |
| FR-15 | The system shall track security deposit, late fee, transfer charge and refund separately for each transaction. | System |
| FR-16 | The system shall allow a librarian to raise a transfer request for a copy from a source library to a destination library. | Librarian |
| FR-17 | The system shall move a transfer request through the states PENDING, APPROVED, IN_TRANSIT and RECEIVED, or CANCELLED before transit. | Librarian |
| FR-18 | The system shall generate notifications and show them in the user's notification page. | System |
| FR-19 | The system shall show the full movement history of any copy. | Librarian |
| FR-20 | The system shall provide summary reports (stock by library, overdue books, transfers, revenue by charge type). | Admin / Librarian |

# 6. Non-Functional Requirements

| Category | Requirement |
| --- | --- |
| Data integrity | Primary keys, foreign keys, UNIQUE and NOT NULL constraints and referential integrity must be enforced by the database, not only by the website. |
| Consistency | Multi-step operations (issue, return, transfer) must run inside database transactions so they either fully succeed or fully roll back. |
| Performance | Search and barcode lookups should respond in under 2 seconds; indexes are created on barcode, ISBN, title, status and foreign keys. |
| Security | Passwords hashed, role-based access, parameterised queries, HTTPS in deployment. |
| Usability | Simple, responsive interface usable on desktop, tablet and mobile browsers; barcode fields work with keyboard-type scanners. |
| Maintainability | Layered code structure (interface, API, database); SQL scripts and documentation kept in the GitHub repository. |
| Scalability | The design supports adding new libraries without changing the schema. |

# 7. System Architecture

The website follows a three-layer architecture. Each layer only talks to the layer next to it.

| Layer | Responsibility | Examples |
| --- | --- | --- |
| 1. Presentation layer (Website / Mobile interface) | Pages that members and librarians use. | Search page, scan screen, dashboards, alerts |
| 2. Application / API layer | Business rules and communication with the database: barcode scans, search, transfers, charge calculation, authentication. | REST endpoints, validation, role checks |
| 3. Data layer (Relational database) | Stores all records and enforces integrity. Source of truth for every record. | Tables, constraints, views, indexes, transactions |


## 7.1 Typical Request Flow (Barcode Scan)

Librarian scans the book barcode on the Scan page; the browser sends it to the API.

Librarian scans the rack or table barcode; the API receives the second value.

The API looks up the copy and its expected location in the database.

The API compares the expected and actual location.

Inside one transaction, the API updates BOOK_COPY, inserts a BOOK_MOVEMENT row, and inserts a NOTIFICATION if the rack is wrong.

The website shows the result (success or wrong-rack alert) to the librarian.

# 8. Website Structure (Sitemap and Pages)

## 8.1 Public Pages

| Page | Purpose |
| --- | --- |
| Home | Introduction to the network and a prominent search bar. |
| Login / Register | Authentication for members, librarians and administrators. |
| Search Results | List of matching books with filters (author, category, year). |
| Book Details | Book information plus a table of libraries with available copies, distance and rack; the nearest match is highlighted. |
| Libraries | List of all libraries with address, contact and map location. |


## 8.2 Member Pages

| Page | Purpose |
| --- | --- |
| Dashboard | Current borrowed books, due dates, deposit held, unread notifications. |
| My Borrowed Books | Books currently issued, with option to start an alternate-library return. |
| Borrow History | Past transactions with library, dates, charges and refunds. |
| Notifications | Due reminders and transfer/return updates. |
| Profile | Edit name, phone and address. |


## 8.3 Librarian Pages

| Page | Purpose |
| --- | --- |
| Librarian Dashboard | Today's issues/returns, wrong-rack alerts, pending transfer requests. |
| Scan Book | Two-step scan: book barcode, then rack or table barcode; shows immediate result. |
| Issue / Return Counter | Issue a copy to a member or receive a return (own or another library's book). |
| Copies Management | Add and edit book copies and barcodes; see status and current location. |
| Racks and Tables | Manage racks (with category) and reading tables (with area). |
| Copy Tracker | Search by barcode to see the full movement history timeline. |
| Wrong-Rack Alerts | List of misplaced copies with expected and actual rack. |
| Transfer Requests | Create requests and update status (approve, in transit, received, cancel). |
| Library Reports | Stock, overdue and activity summaries for this library. |


## 8.4 Administrator Pages

| Page | Purpose |
| --- | --- |
| Manage Libraries | Add/edit libraries and coordinates. |
| Manage Users | Create librarian accounts, assign to a library, deactivate users. |
| Manage Catalog | Authors and books (titles, ISBN, category, publisher, year). |
| Settings | Transfer rate per km, security deposit amount, late fee per day. |
| Network Reports | Stock by library, transfers, revenue by charge type, most-moved copies. |

# 9. Core Feature Specifications

## 9.1 Barcode-Based Physical Tracking

Each copy carries a barcode in the format LIB-<library code>-BC<number> (for example LIB-A-BC1023). Racks and reading tables also carry barcodes. A scan updates the copy as follows:

| Physical action | Scan performed | Status after | Location after |
| --- | --- | --- | --- |
| Book leaves Rack R12 | Scan book | IN_TRANSIT | None (with reader) |
| Student sits at Table T05 | Scan book + table | READING | Table T05 |
| Student finishes reading | Scan book | RETURNING | None (with staff/reader) |
| Book placed back | Scan book + rack | AVAILABLE | Rack (checked against expected rack) |

The web application can accept barcode input from a keyboard-type USB scanner (it types the code and presses Enter), from manual entry, or from a phone camera using a JavaScript barcode-reading library.

## 9.2 Wrong-Rack Detection

The librarian scans copy BC-1023 and then a rack barcode.

The system reads the copy's expected rack (for example R12) from the database.

The scanned rack (for example R18) is compared with the expected rack.

If they differ, the system creates a NOTIFICATION and shows: “Atomic Habits — Copy BC-1023 has been placed in the wrong rack.”

The movement is still recorded so the true location is known and the librarian can correct it.

## 9.3 Cross-Library Search and Nearest Library

Search accepts an exact title, author, category (for example “machine learning books”), ISBN, publication year, or a keyword. For the chosen book the system counts copies with status AVAILABLE at each library and calculates the distance between the user's location and each library using the latitude/longitude stored in LIBRARY (Haversine formula). Results are sorted by distance.

| Library | Available copies | Distance | Result |
| --- | --- | --- | --- |
| Library A | 0 | — | No stock |
| Library B | 3 | 3.5 km | Best match (Rack R12) |
| Library C | 1 | 8.2 km | Available |


## 9.4 Borrow in One City, Return in Another

A member borrows a copy at Library A. If the member travels, the copy can be returned at Library B. The librarian at Library B scans the copy; the system records Library B as the return library, stores the transfer distance, calculates the transfer charge, updates the copy's library and location, and marks the transaction Returned at Alternate Library.

## 9.5 Financial Model

The transfer charge covers moving the physical book between libraries. It is not a charge for the user's personal travel. The rate is configurable by the administrator.

| Item | Description | Example |
| --- | --- | --- |
| Security deposit | Held when a book is issued; released or refunded on return as per rules. | ₹500 |
| Transfer / handling charge | Distance in km × configured rate per km. | 200 km × ₹2 = ₹400 |
| Late fee | Charged when a book is returned after the due date. | Configured per day |
| Refund | Amount returned to the member after deductions. | Deposit − charges |

Assumption to confirm with your guide: In the slide example a ₹500 deposit is held and a ₹400 transfer charge applies. This document assumes the charge and any late fee are settled from the deposit and the balance (₹100 in the example) is refunded. Change the rule in the API layer if your project rules differ.

## 9.6 Inter-Library Transfer Requests

When a library has low or no stock and another library has spare copies, a librarian raises a transfer request. The status moves through this flow:

| Status | Meaning |
| --- | --- |
| PENDING | Request created by a librarian. |
| APPROVED | Source library agrees to send the copy. |
| IN_TRANSIT | Copy has left the source library; copy status is set to in transit. |
| RECEIVED | Destination library received the copy; the copy's library is updated and a movement is logged. |
| CANCELLED | Alternate path: request withdrawn before the copy went in transit. |

## 9.7 Notifications

Due-date reminder and overdue notice to the member.

Wrong-rack alert to the librarian.

Return-at-alternate-library confirmation with charge details to the member.

Transfer request status change to the requesting librarian.

# 10. Database Design

The database has eleven core entities that capture the full journey of a book. Two small supporting lookup tables (PUBLISHER and CATEGORY) are referenced by BOOK, as shown in the Review I schema.

## 10.1 Entities Summary

| Entity | Purpose | Primary key |
| --- | --- | --- |
| USER | Members, librarians and administrators | user_id |
| AUTHOR | Book authors | author_id |
| BOOK | A title (one row per title) | book_id |
| BOOK_COPY | A physical copy with unique barcode and current location | copy_id |
| LIBRARY | A library branch with coordinates | library_id |
| RACK | A rack in a library | rack_id |
| READING_TABLE | A reading table or area in a library | table_id |
| BOOK_MOVEMENT | Log of every scan/movement of a copy | movement_id |
| BORROW_TRANSACTION | Issue, return, fees and deposit information | transaction_id |
| TRANSFER_REQUEST | Request to move a copy between libraries | transfer_id |
| NOTIFICATION | Messages sent to users | notification_id |


## 10.2 Key Design Decision: BOOK vs BOOK_COPY

A book is not stored as “Atomic Habits, Quantity = 10”. Instead, one BOOK row (the title) has many independent BOOK_COPY rows (the physical reality). Each copy has its own barcode, status, library and location. This is a one-to-many relationship and is what makes individual tracking possible. The quantity of a book is always calculated with COUNT() on BOOK_COPY and never stored.

## 10.3 Relationships

| Relationship | Cardinality | Foreign key |
| --- | --- | --- |
| AUTHOR — BOOK | One to many | BOOK.author_id |
| BOOK — BOOK_COPY | One to many | BOOK_COPY.book_id |
| LIBRARY — BOOK_COPY | One to many | BOOK_COPY.library_id |
| LIBRARY — RACK | One to many | RACK.library_id |
| LIBRARY — READING_TABLE | One to many | READING_TABLE.library_id |
| BOOK_COPY — BOOK_MOVEMENT | One to many | BOOK_MOVEMENT.copy_id |
| USER — BOOK_MOVEMENT | One to many | BOOK_MOVEMENT.user_id |
| BOOK_COPY — BORROW_TRANSACTION | One to many (over time) | BORROW_TRANSACTION.copy_id |
| USER — BORROW_TRANSACTION | One to many | BORROW_TRANSACTION.user_id |
| LIBRARY — BORROW_TRANSACTION | One to many (issue and return library) | issue_library_id, return_library_id |
| BOOK_COPY — TRANSFER_REQUEST | One to many (over time) | TRANSFER_REQUEST.copy_id |
| LIBRARY — TRANSFER_REQUEST | One to many (source and destination) | source_library_id, destination_library_id |
| USER — TRANSFER_REQUEST | One to many | TRANSFER_REQUEST.requested_by |
| USER — NOTIFICATION | One to many | NOTIFICATION.user_id |
| BORROW_TRANSACTION — NOTIFICATION | One to many (optional) | NOTIFICATION.transaction_id |


Insert your ER diagram (Slide 15 of the Review I presentation, crow's-foot notation) here as a figure: Figure 10.1 — Entity–Relationship Diagram.

## 10.4 Data Dictionary

Columns marked with * are small additions needed by the website (for login, wrong-rack detection, and fee tracking) that go beyond the Review I slide schema. Keep them or remove them so that this document matches your final ER diagram.

### USER

Stores every person who logs in to the website.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| user_id | INT | PK, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(120) | UNIQUE, NOT NULL |
| phone | VARCHAR(15) |  |
| address | VARCHAR(255) |  |
| password_hash * | VARCHAR(255) | NOT NULL (never store plain passwords) |
| role * | ENUM('MEMBER','LIBRARIAN','ADMIN') | NOT NULL, default MEMBER |
| library_id * | INT | FK → LIBRARY, NULL for members (set for librarians) |


### AUTHOR

Author of one or more books.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| author_id | INT | PK, AUTO_INCREMENT |
| author_name | VARCHAR(100) | NOT NULL |


### BOOK

One row per title.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| book_id | INT | PK, AUTO_INCREMENT |
| author_id | INT | FK → AUTHOR, NOT NULL |
| title | VARCHAR(200) | NOT NULL |
| isbn | VARCHAR(20) | UNIQUE |
| publication_year | YEAR / INT |  |
| publisher_id | INT | FK → PUBLISHER (supporting lookup) |
| category_id | INT | FK → CATEGORY (supporting lookup) |


### LIBRARY

One row per library branch; latitude and longitude enable distance calculation.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| library_id | INT | PK, AUTO_INCREMENT |
| library_name | VARCHAR(100) | NOT NULL |
| address | VARCHAR(255) |  |
| phone / email | VARCHAR(15) / VARCHAR(120) |  |
| latitude | DECIMAL(9,6) | NOT NULL, between −90 and 90 |
| longitude | DECIMAL(9,6) | NOT NULL, between −180 and 180 |


### RACK and READING_TABLE

Physical places inside a library where a copy can be.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| rack_id / table_id | INT | PK, AUTO_INCREMENT |
| library_id | INT | FK → LIBRARY, NOT NULL |
| rack_number / table_number | VARCHAR(20) | NOT NULL; UNIQUE together with library_id |
| category (rack) / area_name (table) | VARCHAR(60) | Subject of the rack / area of the table |


### BOOK_COPY

The most important table. One row per physical copy.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| copy_id | INT | PK, AUTO_INCREMENT |
| book_id | INT | FK → BOOK, NOT NULL |
| library_id | INT | FK → LIBRARY, NOT NULL (library that currently owns/holds the copy) |
| barcode | VARCHAR(30) | UNIQUE, NOT NULL (e.g. LIB-A-BC1023) |
| status | ENUM | AVAILABLE, IN_TRANSIT, READING, RETURNING, BORROWED, LOST; NOT NULL |
| current_location_type | ENUM('RACK','TABLE','NONE') | Tells which table current_location_id points to |
| current_location_id | INT | Rack or table id, NULL when the copy is with a person |
| home_rack_id * | INT | FK → RACK; the expected rack used for wrong-rack detection |


### BOOK_MOVEMENT

Append-only log; rows are inserted on every scan and never edited.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| movement_id | INT | PK, AUTO_INCREMENT |
| copy_id | INT | FK → BOOK_COPY, NOT NULL |
| from_location_id / to_location_id | INT | Rack or table id (with matching type columns *) |
| user_id | INT | FK → USER (who performed the scan) |
| scan_time | DATETIME | NOT NULL, default CURRENT_TIMESTAMP |
| movement_type | ENUM | e.g. PICKED, PLACED_TABLE, PLACED_RACK, ISSUED, RETURNED, TRANSFERRED |


### BORROW_TRANSACTION

One row per borrowing, including fees.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| transaction_id | INT | PK, AUTO_INCREMENT |
| copy_id / user_id | INT | FK → BOOK_COPY / USER, NOT NULL |
| issue_library_id | INT | FK → LIBRARY, NOT NULL |
| return_library_id | INT | FK → LIBRARY, NULL until returned |
| issue_date / due_date | DATE | NOT NULL; due_date ≥ issue_date |
| return_date | DATE | NULL until returned |
| deposit_amount | DECIMAL(8,2) | NOT NULL, ≥ 0 |
| late_fee * | DECIMAL(8,2) | Default 0 |
| transfer_distance_km * | DECIMAL(7,2) | Default 0 |
| transfer_charge | DECIMAL(8,2) | Default 0 |
| refund_amount * | DECIMAL(8,2) | NULL until returned |
| status | ENUM | ISSUED, RETURNED, RETURNED_ALT_LIBRARY, OVERDUE |


### TRANSFER_REQUEST

Tracks moving a copy from one library to another.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| transfer_id | INT | PK, AUTO_INCREMENT |
| copy_id | INT | FK → BOOK_COPY, NOT NULL |
| source_library_id / destination_library_id | INT | FK → LIBRARY, NOT NULL; CHECK source ≠ destination |
| requested_by | INT | FK → USER (librarian) |
| request_date | DATE | NOT NULL |
| status | ENUM | PENDING, APPROVED, IN_TRANSIT, RECEIVED, CANCELLED |


### NOTIFICATION

Messages shown on the website.

| Column | Data type | Constraints / notes |
| --- | --- | --- |
| notification_id | INT | PK, AUTO_INCREMENT |
| user_id | INT | FK → USER, NOT NULL |
| transaction_id | INT | FK → BORROW_TRANSACTION, NULL for non-borrow alerts (e.g. wrong rack) |
| type | VARCHAR(30) | DUE_REMINDER, OVERDUE, WRONG_RACK, TRANSFER_UPDATE, RETURN_CONFIRMATION |
| message | VARCHAR(255) | NOT NULL |
| sent_at | DATETIME | Default CURRENT_TIMESTAMP |
| status | ENUM('UNREAD','READ') | Default UNREAD |


## 10.5 Primary Keys and Foreign Keys

A primary key uniquely identifies one row in a table and no two rows share it. A foreign key connects one table to another by referencing a primary key in a different table. For example, every BOOK_COPY has a book_id (FK to BOOK) and a library_id (FK to LIBRARY), so each physical copy belongs to exactly one title and exactly one library. Referential integrity ensures that a copy can never point to a book or library that does not exist.

## 10.6 Planned DBMS Concepts to Demonstrate

| Concept | Where it is used in this project |
| --- | --- |
| DDL | CREATE/ALTER of all tables, constraints and indexes. |
| DML | INSERT/UPDATE/DELETE when issuing, returning and moving copies. |
| DQL / JOIN queries | Search across BOOK, AUTHOR, BOOK_COPY and LIBRARY; copy history. |
| Aggregate functions | COUNT of available copies per library, SUM of fees, GROUP BY reports. |
| Views | Library stock view, wrong-rack view, overdue view. |
| Constraints | PRIMARY KEY, FOREIGN KEY, UNIQUE (barcode, ISBN), NOT NULL, CHECK. |
| Transactions | Issue, return, alternate-library return and transfer (commit or rollback). |
| Indexes | barcode, isbn, title, status and foreign-key columns. |

# 11. Sample SQL Implementation

The following MySQL-style examples show how the main features map to SQL. Names should be adjusted to match the final schema. Values starting with a colon (for example :book_id) are parameters supplied by the API.

## 11.1 Creating Core Tables (DDL)

CREATE TABLE library (

library_id   INT AUTO_INCREMENT PRIMARY KEY,

library_name VARCHAR(100) NOT NULL,

address      VARCHAR(255),

phone        VARCHAR(15),

email        VARCHAR(120),

latitude     DECIMAL(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),

longitude    DECIMAL(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180)

);


CREATE TABLE book (

book_id          INT AUTO_INCREMENT PRIMARY KEY,

author_id        INT NOT NULL,

title            VARCHAR(200) NOT NULL,

isbn             VARCHAR(20) UNIQUE,

publication_year INT,

publisher_id     INT,

category_id      INT,

FOREIGN KEY (author_id) REFERENCES author(author_id)

);


CREATE TABLE book_copy (

copy_id               INT AUTO_INCREMENT PRIMARY KEY,

book_id               INT NOT NULL,

library_id            INT NOT NULL,

barcode               VARCHAR(30) NOT NULL UNIQUE,

status                ENUM('AVAILABLE','IN_TRANSIT','READING',

'RETURNING','BORROWED','LOST') NOT NULL

DEFAULT 'AVAILABLE',

current_location_type ENUM('RACK','TABLE','NONE') NOT NULL DEFAULT 'NONE',

current_location_id   INT NULL,

home_rack_id          INT NULL,

FOREIGN KEY (book_id)      REFERENCES book(book_id),

FOREIGN KEY (library_id)   REFERENCES library(library_id),

FOREIGN KEY (home_rack_id) REFERENCES rack(rack_id)

);


CREATE INDEX idx_copy_book_status ON book_copy (book_id, status);

## 11.2 Search Books (JOIN)

SELECT b.book_id, b.title, a.author_name, b.isbn, b.publication_year

FROM book b

JOIN author a ON a.author_id = b.author_id

WHERE b.title       LIKE CONCAT('%', :q, '%')

OR a.author_name LIKE CONCAT('%', :q, '%')

OR b.isbn        = :q;

## 11.3 Nearest Library with an Available Copy (Aggregate + Distance)

SELECT l.library_id, l.library_name,

COUNT(bc.copy_id) AS available_copies,

ROUND(6371 * ACOS(LEAST(1,

COS(RADIANS(:user_lat)) * COS(RADIANS(l.latitude)) *

COS(RADIANS(l.longitude) - RADIANS(:user_lng)) +

SIN(RADIANS(:user_lat)) * SIN(RADIANS(l.latitude))

)), 1) AS distance_km

FROM library l

JOIN book_copy bc ON bc.library_id = l.library_id

WHERE bc.book_id = :book_id AND bc.status = 'AVAILABLE'

GROUP BY l.library_id, l.library_name, l.latitude, l.longitude

ORDER BY distance_km ASC;

## 11.4 Wrong-Rack View

CREATE VIEW v_wrong_rack AS

SELECT bc.barcode, b.title,

hr.rack_number AS expected_rack,

cr.rack_number AS actual_rack,

l.library_name

FROM book_copy bc

JOIN book b   ON b.book_id   = bc.book_id

JOIN rack hr  ON hr.rack_id  = bc.home_rack_id

JOIN rack cr  ON bc.current_location_type = 'RACK'

AND cr.rack_id = bc.current_location_id

JOIN library l ON l.library_id = bc.library_id

WHERE bc.current_location_id <> bc.home_rack_id;

## 11.5 Movement History of a Copy

SELECT m.scan_time, m.movement_type,

m.from_location_id, m.to_location_id, u.name AS scanned_by

FROM book_movement m

JOIN book_copy bc ON bc.copy_id = m.copy_id

LEFT JOIN user u  ON u.user_id  = m.user_id

WHERE bc.barcode = :barcode

ORDER BY m.scan_time;

## 11.6 Return at an Alternate Library (Transaction)

START TRANSACTION;


UPDATE borrow_transaction

SET return_library_id     = :return_lib,

return_date           = CURDATE(),

transfer_distance_km  = :km,

transfer_charge       = :km * :rate_per_km,

refund_amount         = deposit_amount - late_fee - (:km * :rate_per_km),

status                = 'RETURNED_ALT_LIBRARY'

WHERE transaction_id = :tid AND status = 'ISSUED';


UPDATE book_copy

SET library_id = :return_lib, status = 'RETURNING',

current_location_type = 'NONE', current_location_id = NULL

WHERE copy_id = :copy_id;


INSERT INTO book_movement (copy_id, user_id, movement_type)

VALUES (:copy_id, :librarian_id, 'RETURNED');


COMMIT;   -- ROLLBACK if any statement fails

## 11.7 Stock Report (Aggregate)

SELECT l.library_name, b.title, COUNT(*) AS total_copies,

SUM(bc.status = 'AVAILABLE') AS available_now

FROM book_copy bc

JOIN library l ON l.library_id = bc.library_id

JOIN book b    ON b.book_id    = bc.book_id

GROUP BY l.library_name, b.title

ORDER BY l.library_name, b.title;

# 12. API Design

The API layer exposes REST endpoints in JSON format. All endpoints except public search and login require authentication, and role checks are applied on every protected route.

| Method | Endpoint | Purpose | Role |
| --- | --- | --- | --- |
| POST | /api/auth/register | Register a new member | Public |
| POST | /api/auth/login | Log in and receive a session/token | Public |
| GET | /api/books?q= | Search books by title, author, ISBN, category, year | Public |
| GET | /api/books/:id/availability?lat=&lng= | Libraries with available copies, sorted by distance | Public |
| GET | /api/libraries | List libraries | Public |
| POST | /api/scan | Submit a book scan and optional location scan; returns result or wrong-rack alert | Librarian |
| GET | /api/copies/:barcode/history | Movement history of a copy | Librarian |
| POST | /api/copies | Add a new copy with barcode | Librarian |
| POST | /api/transactions/issue | Issue a copy to a member | Librarian |
| POST | /api/transactions/:id/return | Return a copy at this library (own or alternate) | Librarian |
| GET | /api/me/transactions | Current and past borrowings of the logged-in member | Member |
| POST | /api/transfers | Create a transfer request | Librarian |
| PATCH | /api/transfers/:id | Change transfer status | Librarian |
| GET | /api/alerts/wrong-rack | List wrong-rack copies for the librarian's library | Librarian |
| GET | /api/notifications | Notifications for the logged-in user | All |
| PUT | /api/admin/settings | Update rate per km, deposit, late fee | Admin |
| GET | /api/admin/reports/stock | Network stock report | Admin |

# 13. User Interface Design Guidelines

Search first: the home page has one large search box, because discovery is the most frequent member task.

Clear availability: show green for available, amber for low stock, grey for no stock, and always show distance in km.

Two-step scan screen: large input focused automatically; after the book scan the field switches to the location scan; the result is shown as a big success or red warning banner.

Timeline view: the copy tracker shows movements as a vertical timeline (time, from, to, who).

Alerts visible: wrong-rack alerts and pending transfers appear on the librarian dashboard.

Responsive design: layouts work on a phone browser so that librarians can scan using a mobile device.

Accessibility: readable font sizes, sufficient colour contrast, and labels on all form fields.

## 13.1 Suggested Page Layouts

| Page | Main elements |
| --- | --- |
| Home | Navigation bar, search box with filters, quick links to nearby libraries. |
| Book Details | Title/author/ISBN block; table of libraries: name, available copies, distance, rack; highlighted “Best match” row. |
| Scan Book (Librarian) | Step indicator, barcode input, last scans list, result banner. |
| Copy Tracker | Barcode search box, copy summary card, movement timeline. |
| Transfer Requests | Filter by status, table of requests, action buttons to advance status. |

# 14. Technology Stack

The following stack is proposed. It can be replaced with equivalent technologies your team is comfortable with, provided the relational database remains the backbone.

| Layer | Suggested technology | Reason |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript (optionally React) | Simple, widely known, responsive. |
| Backend / API | Node.js with Express (or Python Flask) | Quick to build REST APIs and connect to SQL. |
| Database | MySQL (or PostgreSQL) | Supports all planned DBMS features: constraints, views, indexes, transactions. |
| Barcode input | Keyboard-type scanner or JavaScript camera library | No special hardware drivers required. |
| Version control | Git and GitHub | Store source code, schema scripts and documentation. |
| Tools | MySQL Workbench / dbdiagram.io, Postman | ER diagram and API testing. |

## 14.1 Suggested Repository Structure

library-tracking-system/

├── database/

│   ├── schema.sql        # DDL: tables, constraints, indexes

│   ├── seed.sql          # sample libraries, books, copies

│   ├── views.sql         # v_wrong_rack, v_library_stock, ...

│   └── queries.sql       # demo JOIN / aggregate queries

├── backend/

│   ├── routes/           # auth, books, scan, transactions, transfers

│   ├── services/         # charge calculation, distance, alerts

│   └── server.js

├── frontend/

│   ├── pages/            # home, search, book, scan, tracker ...

│   └── assets/

├── docs/                 # this document, ER diagram, presentation

└── README.md

# 15. Security Considerations

Authentication: passwords stored only as salted hashes (for example bcrypt); sessions or tokens expire.

Authorization: every API route checks the role; a librarian can only modify data of their own library.

SQL injection: all queries use parameters (prepared statements); no string concatenation with user input.

Input validation: barcodes, ISBNs, dates and amounts validated on both website and server.

Data integrity: database constraints and transactions protect against inconsistent states even if the application has a bug.

Auditability: BOOK_MOVEMENT is append-only, so no scan can be silently removed.

Transport security: HTTPS when deployed; no secrets in the GitHub repository (use environment variables).

# 16. Testing Plan

| ID | Test case | Expected result |
| --- | --- | --- |
| TC-01 | Register with an email that already exists. | Rejected; UNIQUE constraint on email. |
| TC-02 | Insert two copies with the same barcode. | Second insert fails; UNIQUE constraint on barcode. |
| TC-03 | Scan copy BC-1023 into its expected rack R12. | Status AVAILABLE, location R12, movement logged, no alert. |
| TC-04 | Scan copy BC-1023 into rack R18 (expected R12). | Wrong-rack alert displayed and notification created. |
| TC-05 | Search “machine learning books”. | Books of matching category/keyword are listed. |
| TC-06 | Open Atomic Habits with libraries having 0, 3 and 1 copies. | Library B (3 copies, 3.5 km) highlighted as best match. |
| TC-07 | Return a book borrowed at Library A to Library B (200 km, ₹2/km). | Transfer charge ₹400; status “Returned at Alternate Library”; copy now belongs to Library B. |
| TC-08 | Return after the due date. | Late fee calculated and stored separately. |
| TC-09 | Raise transfer request with source = destination. | Rejected by CHECK constraint/validation. |
| TC-10 | Move transfer request PENDING → APPROVED → IN_TRANSIT → RECEIVED. | Each change saved; copy library updated on RECEIVED. |
| TC-11 | Simulate an error midway through an alternate-library return. | Transaction rolls back; no partial data saved. |
| TC-12 | Member tries to open a librarian page. | Access denied. |

# 17. Implementation Roadmap

| Phase | Deliverables | Status |
| --- | --- | --- |
| Review I — Design | Problem definition, features, 11-entity design, ER diagram, relational schema, planned DBMS operations. | Completed |
| Review II — Database build | Schema (DDL), constraints, sample data (DML), basic CRUD queries, JOIN and aggregate queries. | Planned |
| Review III — Core website | Authentication, catalog and search pages, book details with library availability and distance, librarian scan page and movement history. | Planned |
| Review IV — Advanced features | Issue/return, alternate-library return with charges, transfer requests, notifications, views, indexes, transactions. | Planned |
| Final — Testing and submission | Testing, bug fixing, reports, final documentation, GitHub repository with source code and schema scripts. | Planned |

Adjust the review names and dates above to match your college's schedule.

# 18. Team Responsibilities

| Responsibility | Scope | Assigned to |
| --- | --- | --- |
| Database / ER Design | Entities, ER diagram, schema, constraints, SQL scripts. | [Name] |
| Backend Development | API endpoints, business rules, charge and distance calculation. | [Name] |
| Frontend Development | Pages, forms, search and scan screens, responsive design. | [Name] |
| Testing / Documentation | Test cases, bug reports, this document, presentation. | [Name] |

GitHub repository (source code, schema scripts and documentation): [INSERT REPOSITORY LINK]

# 19. Limitations and Future Enhancements

## 19.1 Current Limitations

Payments are only recorded in the database; no real payment gateway is connected.

Distance is straight-line (Haversine), not road distance.

Location updates depend on librarians or readers scanning; a book moved without a scan is not detected until the next scan.

Native mobile apps are not part of this project; the website is responsive instead.

## 19.2 Future Enhancements

Online payment gateway for deposits and charges.

Road-distance calculation using a maps API.

RFID tags for automatic detection of book movement.

Recommendation of books using machine learning based on borrowing history (relevant to our AI and ML department).

Native Android/iOS application and QR-code based check-in at reading tables.

Email and SMS delivery of notifications.

# 20. Conclusion

The Smart, Connected Multi-Library Book Tracking & Discovery System turns a book from a simple quantity into a tracked physical object with a unique identity, a live location and a complete history. From finding a misplaced book inside one library to finding the nearest available copy across cities, the relational database connects the complete journey of a book, and the website makes that information usable for members, librarians and administrators.

Database is the backbone. The web application is the interface.

# Appendix A: Glossary

| Term | Meaning |
| --- | --- |
| Book (title) | The abstract work, such as “Atomic Habits”; stored once in BOOK. |
| Book copy | One physical item of a title, with its own barcode; stored in BOOK_COPY. |
| Barcode | Unique code printed on a copy, rack or table, read by a scanner. |
| Movement | A recorded change in a copy's status or location. |
| Wrong-rack alert | Warning raised when the scanned rack differs from the expected rack. |
| Transfer / handling charge | Fee for moving the physical copy between libraries (distance × rate). |
| Security deposit | Amount held from the member when a book is issued. |
| PK / FK | Primary key / foreign key. |
| Referential integrity | Rule that a foreign key must match an existing primary key. |
| Haversine formula | Formula for the straight-line distance between two latitude/longitude points. |
