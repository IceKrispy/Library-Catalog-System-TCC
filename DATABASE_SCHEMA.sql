-- ============================================================================
-- LIBRARY MANAGEMENT SYSTEM - CATALOGING MODULE DATABASE SCHEMA
-- Database: SQLite 3
-- ============================================================================

-- Authors Table
CREATE TABLE authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    biography TEXT,
    birth_date DATE,
    country TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Publishers Table
CREATE TABLE publishers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    city TEXT,
    country TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories/Genres Table
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_category_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Book Titles (Metadata) Table
CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    isbn TEXT UNIQUE,
    isbn13 TEXT UNIQUE,
    publisher_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    publication_date DATE,
    description TEXT,
    language TEXT DEFAULT 'English',
    pages INTEGER,
    edition TEXT,
    format TEXT CHECK(format IN ('Hardcover', 'Paperback', 'E-book', 'Audiobook', 'Other')),
    is_digital BOOLEAN DEFAULT FALSE,
    cover_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Book Authors Junction Table (Many-to-Many)
CREATE TABLE book_authors (
    book_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    author_order INTEGER DEFAULT 1,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

-- Physical Copies/Inventory Table
CREATE TABLE copies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    copy_number INTEGER DEFAULT 1,
    acquisition_date DATE NOT NULL,
    cost DECIMAL(10, 2),
    condition TEXT CHECK(condition IN ('Excellent', 'Good', 'Fair', 'Poor')) DEFAULT 'Good',
    status TEXT CHECK(status IN ('Available', 'Checked Out', 'Reserved', 'Damaged', 'Lost')) DEFAULT 'Available',
    location_shelf TEXT,
    location_rack TEXT,
    last_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Keywords/Tags Table (for better searchability)
CREATE TABLE keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Book Keywords Junction Table (Many-to-Many)
CREATE TABLE book_keywords (
    book_id INTEGER NOT NULL,
    keyword_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, keyword_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
);

-- Digital Assets Table (for E-books, Audiobooks, PDFs, etc.)
CREATE TABLE digital_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    asset_type TEXT CHECK(asset_type IN ('E-book', 'Audiobook', 'PDF', 'Video', 'Other')) NOT NULL,
    file_path TEXT,
    file_size BIGINT,
    mime_type TEXT,
    access_url TEXT,
    license_type TEXT,
    expiration_date DATE,
    drm_protected BOOLEAN DEFAULT FALSE,
    downloads_allowed INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- External Metadata Cache Table (for ISBNs lookup and external API data)
CREATE TABLE external_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT UNIQUE,
    source TEXT,
    metadata_json TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Books table indexes
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_isbn13 ON books(isbn13);
CREATE INDEX idx_books_publisher_id ON books(publisher_id);
CREATE INDEX idx_books_category_id ON books(category_id);
CREATE INDEX idx_books_title ON books(title);

-- Copies table indexes
CREATE INDEX idx_copies_book_id ON copies(book_id);
CREATE INDEX idx_copies_barcode ON copies(barcode);
CREATE INDEX idx_copies_status ON copies(status);
CREATE INDEX idx_copies_location ON copies(location_shelf);

-- Authors table indexes
CREATE INDEX idx_authors_name ON authors(last_name, first_name);

-- Publishers table indexes
CREATE INDEX idx_publishers_name ON publishers(name);

-- Keywords table indexes
CREATE INDEX idx_book_keywords_book_id ON book_keywords(book_id);
CREATE INDEX idx_book_keywords_keyword_id ON book_keywords(keyword_id);

-- Digital assets indexes
CREATE INDEX idx_digital_assets_book_id ON digital_assets(book_id);
CREATE INDEX idx_digital_assets_asset_type ON digital_assets(asset_type);

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample authors
INSERT INTO authors (first_name, last_name, country) VALUES
('J.K.', 'Rowling', 'United Kingdom'),
('George R.R.', 'Martin', 'United States');

-- Insert sample publishers
INSERT INTO publishers (name, country, website) VALUES
('Penguin Books', 'United Kingdom', 'www.penguin.co.uk'),
('Bantam Books', 'United States', 'www.bantam.com');

-- Insert sample categories
INSERT INTO categories (name, description) VALUES
('Fiction', 'Fictional works'),
('Fantasy', 'Fantasy novels'),
('Science Fiction', 'Science fiction novels');

-- Insert sample books
INSERT INTO books (title, isbn, isbn13, publisher_id, category_id, publication_date, pages, format, language, description)
VALUES
('Harry Potter and the Philosopher\'s Stone', '0747532699', '9780747532699', 1, 2, '1997-06-26', 223, 'Hardcover', 'English', 'The first book in the Harry Potter series'),
('A Game of Thrones', '0553103547', '9780553103540', 2, 2, '1996-08-06', 694, 'Hardcover', 'English', 'The first book in A Song of Ice and Fire series');

-- Link authors to books
INSERT INTO book_authors (book_id, author_id, author_order) VALUES
(1, 1, 1),
(2, 2, 1);

-- Insert sample copies
INSERT INTO copies (book_id, barcode, copy_number, acquisition_date, cost, condition, status, location_shelf)
VALUES
(1, 'BAR-0001-HP01', 1, '2023-01-15', 15.99, 'Excellent', 'Available', 'A-01-001'),
(1, 'BAR-0001-HP02', 2, '2023-02-20', 15.99, 'Good', 'Checked Out', 'A-01-001'),
(2, 'BAR-0002-GOT01', 1, '2023-03-10', 25.99, 'Fair', 'Available', 'B-02-005');
