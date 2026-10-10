# Entity-Relationship (ER) Diagram & Relational Schema

**Project:** Smart, Connected Multi-Library Book Tracking & Discovery System  
**Reference:** Section 10.4 & Section 10.5 of `docs/PROJECT.md`  

---

## 1. Complete Entity-Relationship Diagram

```mermaid
erDiagram
    LIBRARY ||--o{ RACK : "houses"
    LIBRARY ||--o{ READING_TABLE : "houses"
    LIBRARY ||--o{ BOOK_COPY : "stocks"
    LIBRARY ||--o{ USER : "employs (librarians)"
    LIBRARY ||--o{ BORROW_TRANSACTION : "issues at"
    LIBRARY ||--o{ BORROW_TRANSACTION : "returns at"
    LIBRARY ||--o{ TRANSFER_REQUEST : "source library"
    LIBRARY ||--o{ TRANSFER_REQUEST : "destination library"

    CATEGORY ||--o{ BOOK : "categorizes"
    PUBLISHER ||--o{ BOOK : "publishes"
    AUTHOR ||--o{ BOOK : "authors"
    BOOK ||--o{ BOOK_COPY : "manifests as"
    RACK ||--o{ BOOK_COPY : "assigned home rack"

    BOOK_COPY ||--o{ BORROW_TRANSACTION : "borrowed via"
    BOOK_COPY ||--o{ BOOK_MOVEMENT : "physical logs"
    BOOK_COPY ||--o{ TRANSFER_REQUEST : "transferred via"

    USER ||--o{ BORROW_TRANSACTION : "borrows"
    USER ||--o{ BOOK_MOVEMENT : "scanned by"
    USER ||--o{ TRANSFER_REQUEST : "requested by"
    USER ||--o{ NOTIFICATION : "receives"

    BORROW_TRANSACTION ||--o{ NOTIFICATION : "references"

    LIBRARY {
        int library_id PK
        string library_name
        string address
        string phone
        string email
        decimal latitude
        decimal longitude
    }

    RACK {
        int rack_id PK
        int library_id FK
        string rack_number
        string category
    }

    READING_TABLE {
        int table_id PK
        int library_id FK
        string table_number
        string area_name
    }

    CATEGORY {
        int category_id PK
        string category_name
    }

    PUBLISHER {
        int publisher_id PK
        string publisher_name
    }

    AUTHOR {
        int author_id PK
        string author_name
    }

    BOOK {
        int book_id PK
        int author_id FK
        string title
        string isbn UK
        int publication_year
        int category_id FK
        int publisher_id FK
    }

    BOOK_COPY {
        int copy_id PK
        int book_id FK
        int library_id FK
        string barcode UK
        string status
        string current_location_type
        int current_location_id
        int home_rack_id FK
    }

    USER {
        int user_id PK
        string name
        string email UK
        string phone
        string address
        string password_hash
        string role
        int library_id FK
    }

    BORROW_TRANSACTION {
        int transaction_id PK
        int copy_id FK
        int user_id FK
        int issue_library_id FK
        int return_library_id FK
        date issue_date
        date due_date
        date return_date
        decimal deposit_amount
        decimal late_fee
        decimal transfer_distance_km
        decimal transfer_charge
        decimal refund_amount
        string status
    }

    BOOK_MOVEMENT {
        int movement_id PK
        int copy_id FK
        string from_location_type
        int from_location_id
        string to_location_type
        int to_location_id
        int user_id FK
        datetime scan_time
        string movement_type
    }

    TRANSFER_REQUEST {
        int transfer_id PK
        int copy_id FK
        int source_library_id FK
        int destination_library_id FK
        int requested_by FK
        date request_date
        string status
    }

    NOTIFICATION {
        int notification_id PK
        int user_id FK
        int transaction_id FK
        string type
        text message
        datetime sent_at
        string status
    }

    SETTINGS {
        int setting_id PK
        string setting_key UK
        string setting_value
        string description
        datetime updated_at
    }
```

---

## 2. Relational Schema Specification

### 1. `LIBRARY`
- **PK:** `library_id`
- **Attributes:** `library_name`, `address`, `phone`, `email`, `latitude`, `longitude`
- **Constraints:**
  - `CHECK (latitude BETWEEN -90.000000 AND 90.000000)`
  - `CHECK (longitude BETWEEN -180.000000 AND 180.000000)`

### 2. `RACK`
- **PK:** `rack_id`
- **FK:** `library_id` $\to$ `LIBRARY(library_id)` ON DELETE RESTRICT
- **Attributes:** `rack_number`, `category`
- **Constraints:** `UNIQUE (library_id, rack_number)`

### 3. `READING_TABLE`
- **PK:** `table_id`
- **FK:** `library_id` $\to$ `LIBRARY(library_id)` ON DELETE RESTRICT
- **Attributes:** `table_number`, `area_name`
- **Constraints:** `UNIQUE (library_id, table_number)`

### 4. `CATEGORY`
- **PK:** `category_id`
- **Attributes:** `category_name` (UNIQUE)

### 5. `PUBLISHER`
- **PK:** `publisher_id`
- **Attributes:** `publisher_name` (UNIQUE)

### 6. `AUTHOR`
- **PK:** `author_id`
- **Attributes:** `author_name`

### 7. `BOOK`
- **PK:** `book_id`
- **FKs:**
  - `author_id` $\to$ `AUTHOR(author_id)`
  - `category_id` $\to$ `CATEGORY(category_id)`
  - `publisher_id` $\to$ `PUBLISHER(publisher_id)`
- **Attributes:** `title`, `isbn` (UNIQUE), `publication_year`
- **Indexes:** `idx_book_title (title)`

### 8. `BOOK_COPY`
- **PK:** `copy_id`
- **FKs:**
  - `book_id` $\to$ `BOOK(book_id)`
  - `library_id` $\to$ `LIBRARY(library_id)`
  - `home_rack_id` $\to$ `RACK(rack_id)`
- **Attributes:** `barcode` (UNIQUE), `status` (`AVAILABLE`, `BORROWED`, `READING`, `IN_TRANSIT`, `RETURNING`, `LOST`), `current_location_type`, `current_location_id`
- **Indexes:** `idx_copy_book_status (book_id, status)`

### 9. `USER`
- **PK:** `user_id`
- **FK:** `library_id` $\to$ `LIBRARY(library_id)` (NULL for members/admin)
- **Attributes:** `name`, `email` (UNIQUE), `phone`, `address`, `password_hash`, `role` (`MEMBER`, `LIBRARIAN`, `ADMIN`)

### 10. `BORROW_TRANSACTION`
- **PK:** `transaction_id`
- **FKs:**
  - `copy_id` $\to$ `BOOK_COPY(copy_id)`
  - `user_id` $\to$ `USER(user_id)`
  - `issue_library_id` $\to$ `LIBRARY(library_id)`
  - `return_library_id` $\to$ `LIBRARY(library_id)`
- **Attributes:** `issue_date`, `due_date`, `return_date`, `deposit_amount`, `late_fee`, `transfer_distance_km`, `transfer_charge`, `refund_amount`, `status` (`ISSUED`, `RETURNED`, `RETURNED_ALT_LIBRARY`, `OVERDUE`)
- **Constraints:** `CHECK (due_date >= issue_date)`
- **Indexes:** `idx_borrow_user_status (user_id, status)`

### 11. `BOOK_MOVEMENT`
- **PK:** `movement_id`
- **FKs:**
  - `copy_id` $\to$ `BOOK_COPY(copy_id)`
  - `user_id` $\to$ `USER(user_id)`
- **Attributes:** `from_location_type`, `from_location_id`, `to_location_type`, `to_location_id`, `scan_time`, `movement_type` (`PICKED`, `PLACED_RACK`, `PLACED_TABLE`, `ISSUED`, `RETURNED`, `TRANSFER_DISPATCH`, `TRANSFER_RECEIVE`)
- **Indexes:** `idx_movement_copy (copy_id)`

### 12. `TRANSFER_REQUEST`
- **PK:** `transfer_id`
- **FKs:**
  - `copy_id` $\to$ `BOOK_COPY(copy_id)`
  - `source_library_id` $\to$ `LIBRARY(library_id)`
  - `destination_library_id` $\to$ `LIBRARY(library_id)`
  - `requested_by` $\to$ `USER(user_id)`
- **Attributes:** `request_date`, `status` (`PENDING`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`)
- **Constraints:** `CHECK (source_library_id <> destination_library_id)`
- **Indexes:** `idx_transfer_status (status)`

### 13. `NOTIFICATION`
- **PK:** `notification_id`
- **FKs:**
  - `user_id` $\to$ `USER(user_id)`
  - `transaction_id` $\to$ `BORROW_TRANSACTION(transaction_id)`
- **Attributes:** `type` (`DUE_REMINDER`, `RETURN_CONFIRMATION`, `WRONG_RACK`, `TRANSFER_UPDATE`), `message`, `sent_at`, `status` (`UNREAD`, `READ`)

### 14. `SETTINGS`
- **PK:** `setting_id`
- **Attributes:** `setting_key` (UNIQUE), `setting_value`, `description`, `updated_at`
