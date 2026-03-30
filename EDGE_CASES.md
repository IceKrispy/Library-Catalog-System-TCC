# Edge Cases & Considerations

## 1. HANDLING DIFFERENT EDITIONS

### Problem
The same book may have multiple editions (1st, 2nd, revised, etc.) with different ISBNs but the same core content.

### Solution
```sql
-- Query to identify different editions
SELECT b1.id, b1.title, b1.edition, b1.isbn, b1.publication_date
FROM books b1
JOIN books b2 ON (
  b1.title = b2.title 
  AND b1.publisher_id = b2.publisher_id
  AND b1.id != b2.id
)
ORDER BY b1.title, b1.publication_date;
```

### Implementation
```javascript
// Mark related editions
async function linkEditions(primaryBookId, relatedEditionIds) {
  const query = `
    INSERT INTO book_editions (primary_book_id, edition_book_id)
    VALUES (?, ?)
  `;
  
  for (const editionId of relatedEditionIds) {
    await db.run(query, [primaryBookId, editionId]);
  }
}

// When searching, optionally show related editions
async function getBookWithEditions(bookId) {
  const book = await db.get('SELECT * FROM books WHERE id = ?', [bookId]);
  const editions = await db.all(
    `SELECT b.* FROM books b
     JOIN book_editions be ON b.id = be.edition_book_id
     WHERE be.primary_book_id = ?`,
    [bookId]
  );
  return { ...book, related_editions: editions };
}
```

### Best Practices
- Use ISBN as unique identifier (ISBN is edition-specific)
- Group editions by title + author + publisher
- Allow linking editions in the UI
- Track edition numbers explicitly (e.g., "2nd Edition", "Revised Edition")

---

## 2. DUPLICATE ISBN HANDLING

### Problem
Occasionally, ISBNs may be incorrectly duplicated or the same ISBN may be used for multiple books (common in self-published works).

### Solution

```javascript
// Pre-insert validation
async function validateISBN(isbn) {
  const existing = await db.get(
    'SELECT id, title FROM books WHERE isbn = ? OR isbn13 = ?',
    [isbn, isbn]
  );

  if (existing) {
    return {
      isDuplicate: true,
      existingBook: existing,
      message: `ISBN already exists for: "${existing.title}"`
    };
  }

  // Validate ISBN checksum
  if (!isValidISBN(isbn)) {
    return {
      isDuplicate: false,
      isInvalid: true,
      message: 'Invalid ISBN format or checksum'
    };
  }

  return { isDuplicate: false, isValid: true };
}

// ISBN validation function
function isValidISBN(isbn) {
  const clean = isbn.replace(/[-\s]/g, '');
  
  if (clean.length === 10) {
    return validateISBN10(clean);
  } else if (clean.length === 13) {
    return validateISBN13(clean);
  }
  return false;
}

function validateISBN10(isbn) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = parseInt(isbn[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

function validateISBN13(isbn) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(isbn[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10 === parseInt(isbn[12], 10);
}
```

### Best Practices
- Always validate ISBN before insertion
- Use both ISBN-10 and ISBN-13 in the database
- Implement a duplicate ISBN review workflow for admin
- Log ISBN conflicts for investigation

---

## 3. BOOKS WITH MULTIPLE AUTHORS

### Problem
Handling co-authorship, editor credits, and author order.

### Solution

```sql
-- Many-to-many with ordering and role
CREATE TABLE book_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    author_order INTEGER NOT NULL,
    role TEXT CHECK(role IN ('Author', 'Co-author', 'Editor', 'Translator', 'Illustrator')) DEFAULT 'Author',
    UNIQUE(book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX idx_book_authors_book_id ON book_authors(book_id);
CREATE INDEX idx_book_authors_order ON book_authors(book_id, author_order);
```

### Implementation
```javascript
// Get authors in correct order
async function getBookAuthors(bookId) {
  return await db.all(
    `SELECT a.*, ba.role, ba.author_order
     FROM book_authors ba
     JOIN authors a ON ba.author_id = a.id
     WHERE ba.book_id = ?
     ORDER BY ba.author_order`,
    [bookId]
  );
}

// Create book with multiple authors
async function createBookWithAuthors(bookData, authorIds) {
  return db.transaction(() => {
    // Create book
    const result = db.run(
      `INSERT INTO books (title, isbn, publisher_id, category_id)
       VALUES (?, ?, ?, ?)`,
      [bookData.title, bookData.isbn, bookData.publisher_id, bookData.category_id]
    );
    
    const bookId = result.lastInsertRowid;
    
    // Link authors in order
    authorIds.forEach((authorId, index) => {
      db.run(
        `INSERT INTO book_authors (book_id, author_id, author_order, role)
         VALUES (?, ?, ?, 'Author')`,
        [bookId, authorId, index + 1]
      );
    });
    
    return bookId;
  })();
}
```

### Best Practices
- Always preserve author order
- Use specific roles (Author, Co-author, Editor, etc.)
- Display authors in order (first author first)
- Support reordering authors in UI

---

## 4. PHYSICAL VS DIGITAL ASSETS

### Problem
Managing the distinction between physical copies and digital versions (e-books, audiobooks).

### Solution

```sql
-- Physical copies for hard inventory tracking
CREATE TABLE copies (
    id INTEGER PRIMARY KEY,
    book_id INTEGER NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('Available', 'Checked Out', 'Reserved', 'Damaged', 'Lost')),
    condition TEXT CHECK(condition IN ('Excellent', 'Good', 'Fair', 'Poor')),
    location_shelf TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Digital assets for unlimited access
CREATE TABLE digital_assets (
    id INTEGER PRIMARY KEY,
    book_id INTEGER NOT NULL,
    asset_type TEXT CHECK(asset_type IN ('E-book', 'Audiobook', 'PDF', 'Video')),
    file_path TEXT,
    license_type TEXT,
    drm_protected BOOLEAN,
    downloads_allowed INTEGER,
    expiration_date DATE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
```

### Implementation
```javascript
// Get inventory summary
async function getInventorySummary(bookId) {
  const physical = await db.get(
    `SELECT 
       COUNT(*) as total_copies,
       SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as available,
       SUM(CASE WHEN status = 'Checked Out' THEN 1 ELSE 0 END) as checked_out,
       SUM(CASE WHEN status = 'Reserved' THEN 1 ELSE 0 END) as reserved,
       SUM(CASE WHEN status = 'Damaged' THEN 1 ELSE 0 END) as damaged,
       SUM(CASE WHEN status = 'Lost' THEN 1 ELSE 0 END) as lost
     FROM copies WHERE book_id = ?`,
    [bookId]
  );

  const digital = await db.all(
    `SELECT asset_type, COUNT(*) as count FROM digital_assets 
     WHERE book_id = ? GROUP BY asset_type`,
    [bookId]
  );

  return {
    physical_inventory: physical,
    digital_assets: digital,
    availability: {
      physical: physical.available || 0,
      digital: digital.length > 0 ? 'Available' : 'Not Available'
    }
  };
}

// Check if book is available (physical OR digital)
async function isBookAvailable(bookId) {
  const physical = await db.get(
    'SELECT COUNT(*) as count FROM copies WHERE book_id = ? AND status = ?',
    [bookId, 'Available']
  );

  const digital = await db.get(
    'SELECT COUNT(*) as count FROM digital_assets WHERE book_id = ?',
    [bookId]
  );

  return physical.count > 0 || digital.count > 0;
}
```

### Best Practices
- Track physical and digital separately
- Use different status workflows (physical = checked out, digital = available/limited)
- Implement DRM for protected content
- Track download limits for licensed digital content
- Separate access controls for each type

---

## 5. HANDLING MISSING OR INCOMPLETE METADATA

### Problem
Some books may not have complete metadata available, or the user may want to add a book without full information.

### Solution

```javascript
// Allow partial creation
async function createBookMinimal(req, res) {
  try {
    const { title, isbn, publisher_id, category_id } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        error: 'Title is required',
        status: 400
      });
    }

    // ISBN is optional but recommended
    if (isbn && await isISBNDuplicate(isbn)) {
      return res.status(409).json({
        error: 'ISBN already exists',
        status: 409
      });
    }

    const book = await db.run(
      `INSERT INTO books (title, isbn, publisher_id, category_id, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        title,
        isbn || null,
        publisher_id || null,
        category_id || null
      ]
    );

    return res.status(201).json({
      id: book.lastInsertRowid,
      title,
      message: 'Book created. Add more details later.',
      incomplete: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message, status: 500 });
  }
}

// Mark books needing review
CREATE TABLE incomplete_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER UNIQUE NOT NULL,
    missing_fields TEXT, -- JSON array of missing required fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

// Check for incomplete records
async function findIncompleteBooks() {
  return await db.all(
    `SELECT b.*, ib.missing_fields
     FROM books b
     LEFT JOIN incomplete_books ib ON b.id = ib.book_id
     WHERE b.isbn IS NULL 
        OR b.publisher_id IS NULL
        OR b.description IS NULL
        OR b.pages IS NULL
     ORDER BY b.created_at DESC`
  );
}
```

### Best Practices
- Make only title required initially
- Allow metadata to be added/updated later
- Track incomplete records for admin review
- Auto-fetch from external APIs when ISBN is provided
- Implement a "Complete Metadata" workflow

---

## 6. BARCODE & COPY TRACKING

### Problem
Managing unique identifiers for each physical copy and handling barcode conflicts.

### Solution

```javascript
// Barcode format validation
function generateBarcode(bookId, copyNumber) {
  const timestamp = Date.now().toString().slice(-6);
  return `LIB-${bookId.toString().padStart(6, '0')}-${copyNumber.toString().padStart(3, '0')}-${timestamp}`;
}

// Validate and check for duplicates
async function validateBarcode(barcode) {
  // Check format
  if (!/^[A-Z0-9\-]+$/.test(barcode)) {
    return { valid: false, message: 'Invalid barcode format' };
  }

  // Check for duplicates
  const existing = await db.get(
    'SELECT id FROM copies WHERE barcode = ?',
    [barcode]
  );

  if (existing) {
    return { valid: false, message: 'Barcode already exists', duplicate: true };
  }

  return { valid: true };
}

// Handle barcode conflicts during copy creation
async function createCopy(book_id, customBarcode = null) {
  let barcode = customBarcode;

  if (!barcode) {
    // Auto-generate if not provided
    const lastCopy = await db.get(
      'SELECT copy_number FROM copies WHERE book_id = ? ORDER BY copy_number DESC LIMIT 1',
      [book_id]
    );
    const nextNumber = (lastCopy?.copy_number || 0) + 1;
    barcode = generateBarcode(book_id, nextNumber);
  } else {
    // Validate custom barcode
    const validation = await validateBarcode(barcode);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
  }

  return await db.run(
    `INSERT INTO copies (book_id, barcode, copy_number, acquisition_date, status)
     VALUES (?, ?, ?, DATE('now'), 'Available')`,
    [book_id, barcode, (await db.get(
      'SELECT COUNT(*) as count FROM copies WHERE book_id = ?',
      [book_id]
    )).count + 1]
  );
}
```

### Best Practices
- Implement barcode generation strategy
- Check for duplicates before insertion
- Use internationally recognized barcode formats (ISBN-13, EAN-13)
- Log all barcode changes for audit trail

---

## 7. SUBJECT CLASSIFICATION CONFLICTS

### Problem
A book may fit multiple categories, or categorization standards differ (Dewey Decimal vs Library of Congress).

### Solution

```sql
-- Support multiple category assignments
CREATE TABLE book_categories (
    book_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    primary_category BOOLEAN DEFAULT FALSE,
    classification_system TEXT CHECK(classification_system IN ('Dewey', 'LOC', 'Custom')),
    PRIMARY KEY (book_id, category_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
```

### Implementation
```javascript
// Assign multiple categories
async function setCategoriesForBook(bookId, categories) {
  return db.transaction(() => {
    // Clear existing categories
    db.run('DELETE FROM book_categories WHERE book_id = ?', [bookId]);

    // Add new categories
    categories.forEach((cat, index) => {
      db.run(
        `INSERT INTO book_categories 
         (book_id, category_id, primary_category, classification_system)
         VALUES (?, ?, ?, ?)`,
        [bookId, cat.id, index === 0, cat.system || 'Custom']
      );
    });
  })();
}
```

### Best Practices
- Allow multiple categories per book
- Mark a primary category
- Track classification system used
- Support Dewey Decimal and Library of Congress

---

## 8. CONCURRENT COPY AVAILABILITY UPDATES

### Problem
Race conditions when multiple users attempt to check out/return the same copy.

### Solution

```javascript
// Use transactions for copy status updates
async function checkoutCopy(copyId, userId) {
  return db.transaction(() => {
    // Lock the copy for update
    const copy = db.get(
      'SELECT * FROM copies WHERE id = ? FOR UPDATE',
      [copyId]
    );

    if (copy.status !== 'Available') {
      throw new Error(`Copy is not available. Current status: ${copy.status}`);
    }

    // Update status atomically
    const result = db.run(
      `UPDATE copies 
       SET status = 'Checked Out', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'Available'`,
      [copyId]
    );

    if (result.changes === 0) {
      throw new Error('Failed to checkout copy - concurrent modification detected');
    }

    // Log the transaction
    db.run(
      `INSERT INTO checkout_audit_log (copy_id, user_id, action, timestamp)
       VALUES (?, ?, 'CHECKOUT', CURRENT_TIMESTAMP)`,
      [copyId, userId]
    );

    return true;
  })();
}

// Create audit log table
CREATE TABLE checkout_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT CHECK(action IN ('CHECKOUT', 'RETURN', 'RESERVE', 'DAMAGE')),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (copy_id) REFERENCES copies(id) ON DELETE CASCADE
);
```

### Best Practices
- Use transactions for all status updates
- Implement optimistic/pessimistic locking
- Maintain audit logs for all copy state changes
- Handle concurrent modification errors gracefully

---

## 9. LANGUAGE & ENCODING CONSIDERATIONS

### Problem
Supporting books in multiple languages and handling special characters.

### Solution

```sql
-- Ensure UTF-8 encoding
PRAGMA encoding = 'UTF-8';

-- Language field
ALTER TABLE books ADD COLUMN language TEXT DEFAULT 'English';
ALTER TABLE books ADD COLUMN original_language TEXT;

-- Support for localized titles
CREATE TABLE book_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    language TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, language),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
```

### Implementation
```javascript
// Get book in preferred language
async function getBookByLanguage(bookId, language = 'English') {
  let book = await db.get(
    'SELECT * FROM books WHERE id = ? AND language = ?',
    [bookId, language]
  );

  if (!book) {
    // Fall back to English if translation not available
    book = await db.get(
      'SELECT * FROM books WHERE id = ? AND language = ?',
      [bookId, 'English']
    );
  }

  if (!book) {
    // Return any available version
    book = await db.get(
      'SELECT * FROM books WHERE id = ?',
      [bookId]
    );
  }

  return book;
}
```

### Best Practices
- Use UTF-8 encoding throughout
- Store original language metadata
- Support translations
- Handle special characters properly in search

---

## 10. PERFORMANCE CONSIDERATIONS

### Problem
Large database queries becoming slow with millions of books.

### Solution

```sql
-- Essential indexes for common queries
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_title ON books(title COLLATE NOCASE);
CREATE INDEX idx_copies_barcode ON copies(barcode);
CREATE INDEX idx_copies_status ON copies(status);
CREATE INDEX idx_copies_book_id ON copies(book_id);
CREATE INDEX idx_book_authors_book_id ON book_authors(book_id);
CREATE INDEX idx_book_keywords_keyword_id ON book_keywords(keyword_id);

-- Full-text search index
CREATE VIRTUAL TABLE books_fts USING fts5(
    title,
    description,
    content = 'books',
    content_rowid = 'id'
);
```

### Implementation
```javascript
// Use FTS for text search
async function searchBooks(query) {
  return await db.all(
    `SELECT b.* FROM books b
     JOIN books_fts fts ON b.id = fts.rowid
     WHERE books_fts MATCH ?
     LIMIT 50`,
    [query]
  );
}

// Pagination for large result sets
async function getPaginatedBooks(page, limit) {
  const offset = (page - 1) * limit;
  return await db.all(
    'SELECT * FROM books ORDER BY title LIMIT ? OFFSET ?',
    [limit, offset]
  );
}
```

### Best Practices
- Index frequently searched columns
- Use full-text search for text queries
- Implement pagination
- Cache frequently accessed data
- Monitor query performance
