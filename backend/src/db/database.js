const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../catalog.db');

let db;

try {
  db = new Database(dbPath);
  console.log(`✓ Connected to database: ${dbPath}`);
} catch (error) {
  console.error('✗ Database connection error:', error.message);
  process.exit(1);
}

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Set a timeout for busy connections
db.pragma('busy_timeout = 5000');

// Lightweight startup migration for circulation transactions.
db.exec(`
  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copy_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    borrower_name TEXT NOT NULL,
    borrower_email TEXT,
    borrower_id TEXT,
    item_type TEXT NOT NULL DEFAULT 'book',
    checkout_date DATE NOT NULL,
    due_date DATE NOT NULL,
    returned_date DATE,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Returned', 'Overdue')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (copy_id) REFERENCES copies(id) ON DELETE RESTRICT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_loans_copy_id ON loans(copy_id);
  CREATE INDEX IF NOT EXISTS idx_loans_book_id ON loans(book_id);
  CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
  CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
`);

module.exports = db;
