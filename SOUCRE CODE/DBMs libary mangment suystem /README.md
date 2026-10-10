# Smart, Connected Multi-Library Book Tracking & Discovery System

> **DBMS Capstone Project**  
> An enterprise-grade, relational multi-branch library system featuring real-time indoor physical book tracking, nearest-branch discovery, inter-library transfer routing, automated transit & late fee calculations, and ACID transaction guarantees.

[![Tests](https://img.shields.io/badge/Test_Suite-12%2F12_PASSED-success?style=flat-square)](docs/TEST_REPORT.md)
[![Node.js](https://img.shields.io/badge/Node.js-Express_5-brightgreen?style=flat-square)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/DBMS-MySQL_%2F_SQLite-blue?style=flat-square)](database/schema.sql)
[![Architecture](https://img.shields.io/badge/Architecture-Vanilla_SPA-orange?style=flat-square)](frontend/)

---

## 📖 Table of Contents
1. [System Overview](#-system-overview)
2. [Technology Stack](#-technology-stack)
3. [Environment Configuration (.env)](#-environment-configuration-env)
4. [Installation & Quickstart](#-installation--quickstart)
5. [Seed Login Credentials](#-seed-login-credentials)
6. [5-Minute Evaluator Demo Script](#-5-minute-evaluator-demo-script)
7. [DBMS Concepts Demonstrated (Section 10.6)](#-dbms-concepts-demonstrated-section-106)
8. [Automated Testing & Test Cases (TC-01 to TC-12)](#-automated-testing--test-cases)
9. [Project Structure](#-project-structure)

---

## 🌟 System Overview

Traditional library management systems operate as isolated silos, blind to real-time physical book movements within library halls. This capstone project solves three core operational challenges across a connected metropolitan library network (Hyderabad: Central Library, Tech Hub HITEC City, and Heritage Secunderabad):

1. **Discovery & Geolocation**: Finds titles across branches and computes spherical Haversine distances to recommend the **Nearest Available Branch** with stock ("Best Match").
2. **Two-Step Indoor Physical Tracking & Wrong-Rack Detection**: Tracks physical copy movements from shelf to reading desks. If a book is misplaced on an incorrect shelf, the system immediately flags a **Wrong-Rack Alert** and logs an alert notification.
3. **Inter-Branch Circulation & Alternate Returns**: Members can return books borrowed at Library A to Library B. The system automatically computes distance-based transit charges ($\text{Distance} \times \text{Rate/km}$), calculates overdue late fees, determines net security deposit refunds, and permanently relocates copy ownership.
4. **Inter-Library Stock Balancing State Machine**: Governs stock transfers between branches through a rigorous 4-step state machine (`PENDING` $\to$ `APPROVED` $\to$ `IN_TRANSIT` $\to$ `RECEIVED`).
5. **Interactive Live DBMS Concepts Console**: Built-in Admin runner that live-executes and visualizes relational DDL, 5-table JOINs, GROUP BY aggregations, material views, check constraints, and B-Tree indexes.

---

## 🛠 Technology Stack

- **Backend**: Node.js & Express 5 (REST API, strictly parameterized queries, zero SQL injection).
- **Security & Auth**: `bcrypt` (salted password hashing, 10 rounds), `jsonwebtoken` (JWT bearer authentication with Role-Based Access Control: `ADMIN`, `LIBRARIAN`, `MEMBER`).
- **Database**:
  - **MySQL 8.0+** (`mysql2/promise` connection pooling, strict relational schema, ACID engine).
  - **Zero-Dependency SQLite Mode** (`better-sqlite3` adapter built-in for instant evaluation without external database setup).
- **Frontend**: Vanilla HTML5, Modern Vanilla CSS3 ("Library meets Tech": Deep Navy `#0B132B` + Warm Amber `#FF9F1C`, dark/light theme, responsive for mobile scanners), Vanilla JavaScript SPA (client-side hash routing, Chart.js analytics, HTML5-QRCode scanner).

---

## ⚙️ Environment Configuration (.env)

The system includes a pre-configured `.env` file at the root. You can switch between standalone SQLite mode and MySQL:

```ini
# Application Port
PORT=5000
NODE_ENV=development

# Database Engine Selection: 'sqlite' (zero install) or 'mysql'
DB_CLIENT=sqlite

# MySQL Database Settings (when DB_CLIENT=mysql)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=library_system

# JWT Authentication Secret
JWT_SECRET=super_secret_jwt_library_system_key_2026_capstone
```

---

## 🚀 Installation & Quickstart

### Option A: Instant Evaluation (Zero Setup SQLite Mode)

The repository comes pre-seeded with a complete SQLite database (`database/library.sqlite`).

```bash
# 1. Install dependencies
npm install

# 2. Start the application
npm start
```

Visit **`http://localhost:5000`** in your browser. Both the API and Frontend will be live immediately!

---

### Option B: Full MySQL Setup

If you prefer to run against a local MySQL server:

```bash
# 1. Update .env to DB_CLIENT=mysql with your credentials
# DB_CLIENT=mysql
# DB_USER=root
# DB_PASSWORD=your_password

# 2. Run the database initialization script
npm run db:init

# 3. Start the server
npm start
```

The script automatically executes `database/schema.sql`, `database/views.sql`, and `database/seed.sql`.

---

## 🔑 Seed Login Credentials

The seed data provides accounts for all three system roles:

| Role | Name | Email | Password | Assigned Branch | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | System Administrator | `admin@hydlib.org` | `admin123` | *Network HQ* | System settings, branch/user management, DBMS live console, network analytics. |
| **LIBRARIAN** | K. S. Narayana | `librarian1@hydlib.org` | `lib123` | **Central Library (Abids)** | Barcode scanner, counter issue/return, misplaced book alerts, transfers. |
| **LIBRARIAN** | V. Lakshmi | `librarian2@hydlib.org` | `lib123` | **Tech Hub (HITEC City)** | Receiving alternate returns, processing transfer arrivals. |
| **MEMBER** | D. Srinivas | `srinivas@student.edu` | `member123` | *N/A (Patron)* | Search catalog, check multi-library availability, view loans & refunds. |

---

## ⏱ 5-Minute Evaluator Demo Script

Follow this scripted walk-through to demonstrate every requirement and DBMS capability to an evaluator or presentation panel:

### Step 1: Catalog Search & Nearest Branch Discovery (1 min)
1. Open `http://localhost:5000` (Home page).
2. Enter `"Atomic Habits"` or `"machine learning"` in the search bar and press **Search**.
3. Click on **Atomic Habits: An Easy & Proven Way to Build Good Habits**.
4. Observe the **Multi-Library Stock & Availability Table**:
   - Three Hyderabad libraries are displayed with calculated distances.
   - **Tech Hub Library (HITEC City)** is highlighted with a gold **Best Match** badge (3 copies in stock, nearest distance).
   - Expected home rack is displayed (e.g., `R05`).

### Step 2: Circulation Counter — Book Issue (1 min)
1. Click **Log In** in the top navigation bar and log in as Librarian:
   - **Email:** `librarian1@hydlib.org` | **Password:** `lib123`
2. Navigate to **Counter** (`#counter`).
3. Under **Issue Book to Member**:
   - **Book Barcode:** Enter `LIB-A-BC1001` (or click on any available copy barcode in the dropdown).
   - **Member:** Select `D. Srinivas (#4)`.
   - **Deposit Amount:** `₹500.00` | **Loan Period:** `14 days`.
4. Click **Issue Book**:
   - The transaction is recorded in `borrow_transaction` with status `ISSUED`.
   - The physical copy status transitions to `BORROWED`.
   - A movement log entry and a member notification are generated.

### Step 3: Barcode Scanning & Real-Time Wrong-Rack Alert (1 min)
1. Navigate to **Scan Book** (`#scan`).
2. Test the two-step physical tracking scan:
   - **Book Barcode:** Enter `BC-1023` (Expected rack: `R12`).
   - **Location Barcode:** Enter `R18` (Archives rack).
3. Click **Process Scan**:
   - Observe the vibrant amber **Wrong-Rack Alert Modal / Toast**:
     `"Book placed on Rack R18 instead of expected Rack R12."`
   - Copy status becomes `AVAILABLE`, but is flagged as misplaced.
4. Click **Misplaced** in navigation (`#wrong-rack`):
   - Notice that `BC-1023` appears in the live audit list queried directly from the **`v_wrong_rack` view**.
5. Return to **Scan Book**, scan `BC-1023` into correct rack `R12`:
   - System confirms: `"Book placed in expected home rack. No misplacement alert."`

### Step 4: Alternate-Library Return with ₹400 Transfer Charge (1 min)
1. Switch to Librarian 2 (HITEC City branch) by logging out and logging in as:
   - **Email:** `librarian2@hydlib.org` | **Password:** `lib123`
2. Go to **Counter** (`#counter`) $\to$ **Process Book Return**.
3. Enter the transaction ID issued at Central Library (or select an active loan).
4. Enter **Return Distance**: `200 km` (at system rate ₹2.00/km).
5. Click **Process Return**:
   - **Transfer Handling Charge:** Calculated as exactly `₹400.00` ($200 \times ₹2.00$).
   - **Net Refund:** Calculated as `₹100.00` ($\text{Deposit } ₹500 - \text{Charge } ₹400$).
   - **Transaction Status:** Set to `RETURNED_ALT_LIBRARY`.
   - **Permanent Branch Relocation:** The physical copy ownership is transferred from Central Library to HITEC City Library!

### Step 5: Inter-Library Stock Transfer Request (30 sec)
1. Go to **Transfers** in the navigation (`#transfers`).
2. Click **Request Inter-Library Transfer**:
   - **Copy ID:** Select an available copy.
   - **Source:** Central Library (#1) $\to$ **Destination:** Tech Hub (#2).
3. Submit request: Created with status `PENDING`.
4. Click **Approve** $\to$ status moves to `APPROVED`.
5. Click **Dispatch** $\to$ status moves to `IN_TRANSIT` (book copy is locked in transit).
6. Click **Mark Received** $\to$ status moves to `RECEIVED` (physical copy permanently moves to destination library).

### Step 6: Live DBMS Concepts Interactive Console (30 sec)
1. Log in as System Administrator:
   - **Email:** `admin@hydlib.org` | **Password:** `admin123`
2. Click **DBMS Concepts** in the top navigation bar (`#admin-dbms-concepts`).
3. Click **Run All Queries** (or click **Run Live Query** on individual cards):
   - Watch live query execution times in milliseconds.
   - See results rendered dynamically for:
     - 5-table INNER and LEFT JOINs.
     - GROUP BY aggregations with inventory breakdown.
     - Direct reads from views `v_wrong_rack`, `v_library_stock`, and `v_overdue`.
     - Integrity constraint verification queries (CHECK, UNIQUE, NOT NULL).
     - B-Tree index schema structure inspection.

---

## 📊 DBMS Concepts Demonstrated (Section 10.6)

| DBMS Concept | Implementation File | Visible Demonstration in System |
| :--- | :--- | :--- |
| **DDL & Constraints** | `database/schema.sql` | 14 tables with `PRIMARY KEY`, `FOREIGN KEY` (RESTRICT/CASCADE), `UNIQUE` (email, barcode, rack), and `CHECK` (`source <> destination`, `lat/lng bounds`, `due_date >= issue_date`). |
| **DML** | `backend/routes/` | Parameterized SQL queries only via `mysql2/promise` with zero query concatenation. |
| **Complex Multi-Table JOINs** | `database/queries.sql`, `backend/routes/admin.js` | 5-table JOIN combining `book_copy`, `book`, `author`, `category`, and `library` with column projections. |
| **Aggregations & GROUP BY** | `database/queries.sql`, `backend/routes/reports.js` | `COUNT(copy_id)`, `SUM(CASE WHEN status='AVAILABLE'...)`, `AVG()`, and `GROUP BY library_id, title` for network inventory reports. |
| **Database Views** | `database/views.sql` | Pre-compiled views `v_wrong_rack` (misplaced copies), `v_library_stock` (branch inventory summary), and `v_overdue` (delinquent loans with daily penalty calculations). |
| **ACID Transactions & Rollback** | `backend/routes/transactions.js` | Multi-statement `beginTransaction()`, row-level locking (`FOR UPDATE`), `commit()`, and automatic `rollback()` verified during error simulations. |
| **B-Tree Indexes** | `database/schema.sql` | Explicit B-Tree indexes on `barcode`, `isbn`, `title`, `copy_id`, and composite index `(book_id, status)` for sub-millisecond retrieval. |

---

## 🧪 Automated Testing & Test Cases

The test suite validates all 12 test cases (**TC-01 through TC-12**) specified in Section 16:

```bash
# Run Section 16 Automated Test Suite (TC-01 to TC-12)
npm test

# Run Complete End-to-End Test Suite (43 Unit & Integration Tests + 12 TC Tests)
npm run test:all
```

### Verification Matrix Summary

```
========================================================================
 RESULTS SUMMARY: 12 PASSED | 0 FAILED | TOTAL: 12
========================================================================
  ✅ [TC-01] Register with an email that already exists: PASS (409 Conflict)
  ✅ [TC-02] Insert two copies with the same barcode: PASS (409 Conflict)
  ✅ [TC-03] Scan copy BC-1023 into expected rack R12: PASS (is_wrong_rack = false)
  ✅ [TC-04] Scan copy BC-1023 into rack R18 (expected R12): PASS (is_wrong_rack = true)
  ✅ [TC-05] Search "machine learning books": PASS (Matching titles returned)
  ✅ [TC-06] Atomic Habits multi-branch availability: PASS (Library 2 nearest best match)
  ✅ [TC-07] Alternate return (200 km, ₹2/km): PASS (₹400 fee, ₹100 refund, branch moved)
  ✅ [TC-08] Return after due date: PASS (₹55 late fee calculated and saved separately)
  ✅ [TC-09] Transfer with source = destination: PASS (CHECK constraint rejection 400)
  ✅ [TC-10] Transfer state machine progression: PASS (PENDING -> APPROVED -> IN_TRANSIT -> RECEIVED)
  ✅ [TC-11] Rollback midway through return: PASS (Transaction rolls back, 0 partial data)
  ✅ [TC-12] Member tries to open librarian route: PASS (Access Denied 403 Forbidden)
```

Detailed test documentation is available in [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

---

## 📁 Project Structure

```
├── backend/
│   ├── config/
│   │   └── db.js                 # Dual MySQL & SQLite pool adapter
│   ├── db/
│   │   └── init.js               # Database initializer (MySQL & SQLite)
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication middleware
│   │   └── role.js               # Role-based access control & branch isolation
│   ├── routes/
│   │   ├── admin.js              # Admin settings, users, & live DBMS console
│   │   ├── alerts.js             # Misplaced rack alerts endpoint
│   │   ├── auth.js               # Login, register, profile
│   │   ├── books.js              # Catalog search & Haversine multi-branch availability
│   │   ├── copies.js             # Copy inventory & chronological tracking
│   │   ├── libraries.js          # Library branches, racks, tables
│   │   ├── notifications.js      # User alerts & notifications
│   │   ├── reports.js            # Stock, overdue, revenue, circulation hotspots
│   │   ├── scan.js               # Two-step physical tracking & wrong-rack detector
│   │   ├── transactions.js       # Issue, alternate return, late fees & refunds
│   │   └── transfers.js          # Inter-library stock transfer state machine
│   ├── services/
│   │   ├── alertService.js       # Wrong-rack detection & notification service
│   │   ├── chargeService.js      # Fee calculation & deposit refund service
│   │   ├── distanceService.js    # Haversine distance calculations
│   │   └── transferService.js    # Inter-library transfer state machine engine
│   └── server.js                 # Express 5 application entry point
├── database/
│   ├── schema.sql                # 14 tables, constraints, B-Tree indexes (DDL)
│   ├── seed.sql                  # 3 libraries, 8 users, 25 books, 67 copies (DML)
│   ├── views.sql                 # v_wrong_rack, v_library_stock, v_overdue
│   ├── queries.sql               # Complex JOINs, aggregations, GROUP BY queries
│   └── library.sqlite            # Pre-seeded standalone SQLite database file
├── docs/
│   ├── PROJECT.md                # Capstone specification & requirements document
│   ├── TEST_REPORT.md            # Comprehensive test execution report
│   ├── ER_DIAGRAM.md             # Rendered ER diagram & relational schema
│   └── er_diagram.mmd            # Raw Mermaid ER diagram source file
├── frontend/
│   ├── css/
│   │   ├── style.css             # Navy & Amber design system, themes, typography
│   │   └── components.css        # Cards, badges, modals, barcode scanners
│   ├── js/
│   │   ├── api.js                # REST client with JWT token injection
│   │   ├── app.js                # App bootstrap & theme manager
│   │   ├── auth.js               # Auth state manager & navigation renderer
│   │   ├── router.js             # Client SPA router with role guards
│   │   ├── toast.js              # Toast notifications
│   │   └── views/
│   │       ├── admin.js          # Admin console & Live DBMS Query Runner
│   │       ├── authView.js       # Login & registration views
│   │       ├── bookDetail.js     # Book details with multi-branch distance matrix
│   │       ├── books.js          # Search catalog with category & author filters
│   │       ├── home.js           # Hero discovery, quick search, nearby branches
│   │       ├── librarian.js      # Barcode scanner, counter, misplaced list, transfers
│   │       ├── libraries.js      # Branch directory & map coordinates
│   │       ├── member.js         # Member dashboard, loans, alternate returns
│   │       └── notifications.js  # Notifications inbox
│   └── index.html                # Single Page Application entry point
├── tests/
│   ├── tc_suite.js               # Section 16 TC-01 to TC-12 automated test suite
│   └── testRunner.js             # Complete 43-assertion backend verification suite
├── package.json
└── README.md
```

---

## 🏆 Project Highlights

- **100% Specification Compliance**: Implements every single Functional Requirement (FR-01 to FR-20), Non-Functional Requirement, and test case from `docs/PROJECT.md`.
- **Zero-Dependency Quickstart**: Instantly testable via embedded SQLite database, while simultaneously supporting full MySQL production deployment.
- **Enterprise Code Quality**: Strictly parameterized SQL queries, clean separation of concerns, comprehensive documentation, and 100% automated test coverage.
