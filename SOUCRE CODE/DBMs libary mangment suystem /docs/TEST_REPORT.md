# Test Report: Automated Verification Suite (Section 16)

**Project:** Smart, Connected Multi-Library Book Tracking & Discovery System  
**Test Suite Reference:** `tests/tc_suite.js` & `tests/testRunner.js`  
**Execution Date:** 2026-10-10  
**Overall Status:** **12 / 12 PASSED (100% Success Rate)**  

---

## 1. Executive Summary

This report documents the automated execution and verification of all 12 test cases (**TC-01 through TC-12**) specified in Section 16 of `docs/PROJECT.md`. The tests validate database constraints (UNIQUE, CHECK, FOREIGN KEY, NOT NULL), business transaction logic (Haversine branch distance, alternate-library transit fees, late fee calculation), two-step barcode scanning with wrong-rack detection, inter-library transfer state transitions, ACID transaction atomicity/rollback, and role-based access control.

All 12 test cases were executed automatically against the live application server and database, passing without errors.

---

## 2. Test Execution Summary

| Test ID | Test Scenario | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | Register with an email that already exists. | Rejected; `UNIQUE` constraint on email (HTTP 409). | HTTP 409 Conflict; duplicate registration rejected with descriptive message. | **PASS** |
| **TC-02** | Insert two copies with the same barcode. | Second insert fails; `UNIQUE` constraint on barcode (HTTP 409). | HTTP 409 Conflict; second copy insert rejected due to unique barcode conflict. | **PASS** |
| **TC-03** | Scan copy `BC-1023` into its expected rack `R12`. | Status `AVAILABLE`, location `R12`, movement logged, no alert (`is_wrong_rack = false`). | Status updated to `AVAILABLE`, physical location set to `R12`, `book_movement` logged, `is_wrong_rack: false`. | **PASS** |
| **TC-04** | Scan copy `BC-1023` into rack `R18` (expected `R12`). | Wrong-rack alert displayed and notification created. | Status `AVAILABLE`, `is_wrong_rack: true`, notification record generated with type `WRONG_RACK`. | **PASS** |
| **TC-05** | Search "machine learning books". | Books of matching category/keyword are listed. | HTTP 200 OK; returns catalog titles in Category "Machine Learning" and titles containing machine learning. | **PASS** |
| **TC-06** | Open *Atomic Habits* with libraries having 0, 3, and 1 copies. | Library B (3 copies, ~3.5 km) highlighted as "Best Match". | Library #2 (Tech Hub Library) identified as nearest branch with stock (3 copies available, nearest distance). | **PASS** |
| **TC-07** | Return a book borrowed at Library A to Library B (200 km, ₹2/km). | Transfer charge ₹400; status "Returned at Alternate Library"; copy belongs to Library B. | Transfer charge calculated as ₹400.00; status `RETURNED_ALT_LIBRARY`; copy ownership relocated to Library #2. | **PASS** |
| **TC-08** | Return after the due date. | Late fee calculated and stored separately. | Late fee of ₹55.00 calculated based on 11 days overdue at ₹5/day; saved in `borrow_transaction.late_fee`. | **PASS** |
| **TC-09** | Raise transfer request with source = destination. | Rejected by `CHECK` constraint / validation (HTTP 400). | HTTP 400 Bad Request; rejected by schema `CHECK` constraint `source_library_id <> destination_library_id`. | **PASS** |
| **TC-10** | Move transfer request `PENDING` → `APPROVED` → `IN_TRANSIT` → `RECEIVED`. | Each change saved; copy library updated on `RECEIVED`. | All status transitions persisted; copy's `library_id` updated to destination library upon `RECEIVED`. | **PASS** |
| **TC-11** | Simulate an error midway through an alternate-library return. | Transaction rolls back; no partial data saved. | HTTP 500 error handled; `ROLLBACK` verified; transaction status remained `ISSUED`, copy remained with borrower. | **PASS** |
| **TC-12** | Member tries to open a librarian page / endpoint. | Access denied (HTTP 403 Forbidden). | Access denied with HTTP 403 Forbidden across scanning, copy management, and counter endpoints. | **PASS** |

---

## 3. Detailed Test Case Analysis

### TC-01: Duplicate Email Registration
- **Category:** Integrity Constraints (DDL `UNIQUE`)
- **Input:** POST `/api/auth/register` with an email already present in table `user` (`email: "tc01_duplicate@student.edu"`).
- **Execution:**
  1. User account successfully registered on first call (`HTTP 201 Created`).
  2. Identical email submitted on second call.
- **Verification:** Database rejects insert via `UNIQUE KEY (email)` constraint; route catches error and returns `HTTP 409 Conflict` with JSON error payload: `"An account with this email address already exists."`.
- **Status:** **PASS**

---

### TC-02: Duplicate Copy Barcode
- **Category:** Integrity Constraints (DDL `UNIQUE`)
- **Input:** POST `/api/copies` with barcode `TC02-DUP-BARCODE` twice by authenticated librarian.
- **Execution:**
  1. First copy created for Book #1 on Rack #1 (`HTTP 201 Created`).
  2. Second copy submitted with identical barcode string.
- **Verification:** Second insert fails on `UNIQUE KEY uq_copy_barcode (barcode)`; backend returns `HTTP 409 Conflict` with `"Duplicate barcode: A copy with barcode ... already exists."`.
- **Status:** **PASS**

---

### TC-03: Expected Rack Scan
- **Category:** Physical Tracking & Movement Logging (Section 9.1)
- **Input:** POST `/api/scan` with `book_barcode: "BC-1023"` and `location_barcode: "R12"`.
- **Expected Rack:** Rack `R12` (Rack ID 16, category "General Reference & Self-Help").
- **Verification:**
  - Copy status transitioned to `AVAILABLE`.
  - `current_location_type` set to `RACK`, and `current_location_id` set to Rack ID 16.
  - `wrong_rack.is_wrong_rack` returned `false`.
  - Row added to `book_movement` with `movement_type = 'PLACED_RACK'`.
  - No wrong-rack alert was triggered.
- **Status:** **PASS**

---

### TC-04: Wrong Rack Misplacement Scan
- **Category:** Wrong-Rack Detection & Alerts (Section 9.2)
- **Input:** POST `/api/scan` with `book_barcode: "BC-1023"` and `location_barcode: "R18"` (expected `R12`).
- **Scanned Rack:** Rack `R18` (Rack ID 17, category "Archives & Special Collections").
- **Verification:**
  - System detected discrepancy between `home_rack_id` (16) and scanned rack (17).
  - API response included `wrong_rack.is_wrong_rack: true` with warning `"Book placed on Rack R18 instead of expected Rack R12."`.
  - New record inserted into table `notification` with `type = 'WRONG_RACK'`.
  - Copy is visible in `v_wrong_rack` view and GET `/api/alerts/wrong-rack`.
- **Status:** **PASS**

---

### TC-05: Catalog Search for "machine learning books"
- **Category:** Multi-Table Query & Full Catalog Filtering (FR-09)
- **Input:** GET `/api/books?q=machine%20learning%20books`.
- **Verification:**
  - Query parsed multi-word phrase and stop words.
  - Returned 4 titles including:
    - *Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow*
    - *Pattern Recognition and Machine Learning*
    - *Machine Learning: A Probabilistic Perspective*
    - *Deep Learning*
  - All returned titles belonged to Category "Machine Learning".
- **Status:** **PASS**

---

### TC-06: Atomic Habits Multi-Branch Availability & Best Match
- **Category:** Haversine Geo-Search & Multi-Branch Stock (FR-10, FR-11)
- **Input:** GET `/api/books/23/availability?lat=17.4474&lng=78.3762` (Book #23: *Atomic Habits*).
- **Branch Stock Profile:**
  - Library #1 (Central): 2 copies (1 in rack, 1 misplaced).
  - Library #2 (Tech Hub - HITEC City): 3 copies available.
  - Library #3 (Heritage - Secunderabad): 1 copy available.
- **Verification:**
  - Distance computed accurately via spherical Haversine formula.
  - Library #2 (0.59 km away with 3 available copies) was ranked first and assigned `best_match: true`.
- **Status:** **PASS**

---

### TC-07: Alternate-Library Return (200 km @ ₹2/km)
- **Category:** Inter-Library Returns & Financials (Section 9.4, 9.5, 11.6)
- **Input:** Book borrowed from Library #1 (Central) returned to Library #2 (Tech Hub) with distance 200 km. Initial deposit: ₹500.00.
- **Calculation:**
  $$\text{Transfer Charge} = 200 \text{ km} \times ₹2.00/\text{km} = ₹400.00$$
  $$\text{Net Refund} = ₹500.00 - ₹400.00 - ₹0.00 = ₹100.00$$
- **Verification:**
  - Transaction status set to `RETURNED_ALT_LIBRARY`.
  - `transfer_charge` stored as `400.00`.
  - `refund_amount` stored as `100.00`.
  - Physical copy `library_id` updated from Library #1 to Library #2.
  - Copy status set to `RETURNING` for shelving into new branch.
- **Status:** **PASS**

---

### TC-08: Return Past Due Date (Late Fee Calculation)
- **Category:** Overdue Borrowing Penalties (Section 9.5)
- **Input:** Return of Transaction #2 (issued 25 days ago, due 11 days ago). Daily penalty: ₹5.00/day.
- **Calculation:**
  $$\text{Days Overdue} = 11 \text{ days}$$
  $$\text{Late Fee} = 11 \times ₹5.00 = ₹55.00$$
  $$\text{Net Refund} = ₹500.00 - ₹55.00 = ₹445.00$$
- **Verification:**
  - `late_fee` stored as `55.00` in `borrow_transaction`.
  - `refund_amount` stored as `445.00`.
  - `days_overdue` and `late_fee` tracked separately from any transit charges.
- **Status:** **PASS**

---

### TC-09: Transfer Request Source = Destination CHECK Constraint
- **Category:** Relational CHECK Constraints (DDL Section 10.4)
- **Input:** POST `/api/transfers` with `source_library_id = 1` and `destination_library_id = 1`.
- **Verification:**
  - Table constraint `chk_transfer_diff_libraries CHECK (source_library_id <> destination_library_id)` rejects the query.
  - API validation returns `HTTP 400 Bad Request` with `"Constraint violation: Source library and destination library cannot be the same."`.
- **Status:** **PASS**

---

### TC-10: Inter-Library Transfer State Machine Progression
- **Category:** Multi-State Workflow & Stock Relocation (Section 9.6)
- **Sequence:**
  1. POST `/api/transfers`: Copy #3 from Library #1 to Library #3 created with status `PENDING` (`HTTP 201`).
  2. PATCH `/api/transfers/:id` with `{ status: 'APPROVED' }`: Transfer status updated to `APPROVED` (`HTTP 200`).
  3. PATCH `/api/transfers/:id` with `{ status: 'IN_TRANSIT' }`: Transfer status updated to `IN_TRANSIT`; Copy #3 status updated to `IN_TRANSIT` (`HTTP 200`).
  4. PATCH `/api/transfers/:id` with `{ status: 'RECEIVED' }`: Transfer status updated to `RECEIVED`; Copy #3 `library_id` permanently updated to `3`, status set to `AVAILABLE` (`HTTP 200`).
- **Status:** **PASS**

---

### TC-11: ACID Transaction Rollback Verification
- **Category:** Database Transactions & Atomicity (Section 10.6)
- **Scenario:** Return process for an active loan is interrupted by an uncaught exception midway through the database operation.
- **Input:** POST `/api/transactions/:id/return` with `{ simulate_error: true }`.
- **Verification:**
  - Endpoint caught exception and issued `conn.rollback()`.
  - HTTP 500 returned to client.
  - Database audit confirms:
    - `borrow_transaction.status` is STILL `ISSUED` (not `RETURNED`).
    - `borrow_transaction.return_date` is STILL `NULL`.
    - Copy `library_id` remained unchanged.
    - No corrupt movement or financial records were written.
- **Status:** **PASS**

---

### TC-12: Role-Based Authorization Guard (Member Denied Librarian Privileges)
- **Category:** Authentication & RBAC Security (Section 8)
- **Input:** Member token used to call protected librarian routes:
  1. POST `/api/scan` (physical barcode tracking)
  2. POST `/api/transactions/issue` (circulation counter book issue)
  3. POST `/api/copies` (physical inventory creation)
- **Verification:**
  - All three endpoints returned `HTTP 403 Forbidden` with `"Permission denied"`.
  - Frontend client router guards verified redirecting unauthorized roles to home view.
- **Status:** **PASS**

---

## 4. How to Re-Run Tests

To execute the automated Section 16 test suite locally:

```bash
# Run the Section 16 test suite (TC-01 through TC-12)
npm test

# Or run explicitly
npm run test:tc

# Run the complete test suite including all 43 endpoint unit tests + TC suite
npm run test:all
```
