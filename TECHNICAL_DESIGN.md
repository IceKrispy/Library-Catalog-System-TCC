# Library Management System - Cataloging System Technical Design

## Executive Summary

This document provides a comprehensive technical design for the **Cataloging Subsystem** of the Library Management System. The cataloging system is responsible for managing the inventory and metadata for all library assets, including physical copies, digital assets, and related metadata (authors, publishers, categories).

**Tech Stack**:
- **Frontend**: React, Vite, React Router, Tailwind CSS
- **Backend**: Node.js, Express.js, CORS
- **Database**: SQLite 3, better-sqlite3

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [External Integrations](#external-integrations)
5. [Key Features](#key-features)
6. [Data Validation](#data-validation)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│           Frontend (React + Vite)                       │
│  - Book Search & Catalog Browse                         │
│  - Inventory Management UI                              │
│  - Metadata Entry Forms                                 │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │ CORS Enabled        │
        │ Express.js          │
        │ Middleware          │
        └──────────┬──────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│  Backend API Layer (Express.js)                         │
│  - Book CRUD Operations                                 │
│  - Author Management                                    │
│  - Publisher Management                                 │
│  - Inventory Tracking                                   │
│  - External API Integration Controller                  │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│  Business Logic Layer                                   │
│  - Metadata Service                                     │
│  - Inventory Service                                    │
│  - Validation Service                                   │
│  - Cache Management                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│  Data Access Layer (better-sqlite3)                     │
│  - Database Connection Pool                             │
│  - Query Execution                                      │
│  - Transaction Management                              │
└──────────────────┬──────────────────────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼─────┐ ┌───▼──────┐ ┌───▼──────┐
│  SQLite   │ │ External │ │  Cache   │
│  Database │ │   APIs   │ │   Layer  │
│           │ │ (Google  │ │(In-Mem)  │
│           │ │ Books,   │ │          │
│           │ │ Open Lib)│ │          │
└───────────┘ └──────────┘ └──────────┘
```

---

## Database Schema

### Core Tables Overview

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `books` | Book metadata | References: publishers, categories |
| `copies` | Physical inventory | References: books |
| `authors` | Author profiles | Many-to-many with books |
| `publishers` | Publisher information | One-to-many with books |
| `categories` | Book classification | One-to-many with books |
| `digital_assets` | E-books, audiobooks, etc. | References: books |
| `book_keywords` | Search tags | Many-to-many with books |
| `external_metadata` | API cache | References: ISBN lookup data |

For detailed schema, see **[DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql)**

### Data Model Diagram

```
                    ┌─────────────┐
                    │  Publishers │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼──┐      ┌───▼────────┐
              │  Books │◄─────┤ Categories │
              └────┬───┘      └────────────┘
                   │
        ┌──────────┼──────────┬──────────────┐
        │          │          │              │
    ┌───▼──┐  ┌───▼─────┐ ┌──▼────────┐ ┌──▼──────────┐
    │Copies│  │  Authors│ │  Keywords │ │Digital Asset│
    └──────┘  │(via J-T)│ │  (via J-T)│ │             │
              └─────────┘ └───────────┘ └─────────────┘
```

---

## API Endpoints

### Core Operations (CRUD)

#### Books Endpoints
- `POST /api/v1/books` - Create a new book
- `GET /api/v1/books` - List all books (paginated)
- `GET /api/v1/books/:id` - Get book details
- `GET /api/v1/books/isbn/:isbn` - Get book by ISBN
- `PUT /api/v1/books/:id` - Update book metadata
- `DELETE /api/v1/books/:id` - Delete a book

#### Copies/Inventory Endpoints
- `POST /api/v1/books/:id/copies` - Add a physical copy
- `GET /api/v1/books/:id/copies` - List copies of a book
- `PATCH /api/v1/copies/:copy_id` - Update copy status/location
- `GET /api/v1/copies/barcode/:barcode` - Get copy by barcode
- `DELETE /api/v1/copies/:copy_id` - Remove a copy

#### Authors Endpoints
- `POST /api/v1/authors` - Create author
- `GET /api/v1/authors` - List authors
- `GET /api/v1/authors/:id` - Get author details
- `PUT /api/v1/authors/:id` - Update author (bio, etc.)
- `DELETE /api/v1/authors/:id` - Delete author

#### Publishers Endpoints
- `POST /api/v1/publishers` - Create publisher
- `GET /api/v1/publishers` - List publishers
- `GET /api/v1/publishers/:id` - Get publisher details
- `PUT /api/v1/publishers/:id` - Update publisher
- `DELETE /api/v1/publishers/:id` - Delete publisher

#### Categories Endpoints
- `POST /api/v1/categories` - Create category
- `GET /api/v1/categories` - List categories (hierarchical)
- `GET /api/v1/categories/:id` - Get category details
- `PUT /api/v1/categories/:id` - Update category
- `DELETE /api/v1/categories/:id` - Delete category

#### Digital Assets Endpoints
- `POST /api/v1/books/:id/digital-assets` - Add e-book/audiobook
- `GET /api/v1/books/:id/digital-assets` - List digital assets
- `PATCH /api/v1/digital-assets/:asset_id` - Update digital asset
- `DELETE /api/v1/digital-assets/:asset_id` - Remove digital asset

#### Search & External Integration
- `GET /api/v1/books/search?q=...&category=...` - Advanced search
- `POST /api/v1/books/fetch-metadata` - Fetch by ISBN from external APIs
- `POST /api/v1/books/bulk-import` - Import multiple books
- `GET /api/v1/books/bulk-import/:job_id` - Check import status

For detailed endpoint specifications, see **[API_DESIGN.md](API_DESIGN.md)**

---

## External Integrations

### Recommended APIs

#### 1. Google Books API
- **Coverage**: 40M+ books
- **Metadata Quality**: High
- **Cost**: Free tier (rate limited), $1.50/1000 requests
- **Best For**: Recent and mainstream publications

#### 2. Open Library API
- **Coverage**: 2M+ books
- **Metadata Quality**: Medium-High
- **Cost**: Free (no rate limits)
- **Best For**: Classic and rare books, free alternative

### Integration Architecture

```
User Input (ISBN)
       │
       ▼
┌─────────────────────────┐
│  Metadata Cache Check   │
└────┬──────────────────┬─┘
     │ Hit              │ Miss
     │                  ▼
     │         ┌────────────────────┐
     │         │ Google Books API   │
     │         └────┬───────────┬───┘
     │              │ Success   │ Failure
     │              ▼           │
     │         ┌─────────────┐   │
     │         │ Success ✓   │   │
     │         └─────┬───────┘   │
     │               │           ▼
     │               │      ┌─────────────────────┐
     │               │      │ Open Library API    │
     │               │      └────┬───────────┬────┘
     │               │           │ Success   │ Failure
     │               │           ▼           │
     │               │      ┌──────────┐     │
     │               └─────►│  Cache   │     │
     │                      └─────┬────┘     │
     │                            │          │
     ▼                            ▼          ▼
  Return from Cache      Return from API   Manual Entry
```

For implementation details, see **[INTEGRATIONS.md](INTEGRATIONS.md)**

---

## Key Features

### 1. **Inventory Management**
- Track physical copies with unique barcodes
- Monitor copy status (Available, Checked Out, Damaged, Lost)
- Track condition and maintenance history
- Shelf location management

### 2. **Metadata Management**
- Comprehensive book information (title, ISBN, authors, publisher, etc.)
- Multi-author support with authorship order
- Hierarchical category system
- Support for multiple editions
- Digital asset support (e-books, audiobooks, PDFs)

### 3. **Search & Discovery**
- Full-text search across titles and descriptions
- Advanced filtering (category, author, publisher, language)
- ISBN lookup
- Barcode scanning for copies
- Pagination for large result sets

### 4. **External Integration**
- Automatic metadata fetching via ISBN
- Bulk import capabilities
- API caching to reduce external calls
- Fallback mechanisms for service failures

### 5. **Data Quality**
- ISBN validation (format and checksum)
- Duplicate ISBN detection
- Incomplete record tracking
- Audit logging for all changes

---

## Data Validation

### Required vs. Optional Fields

```
Books Table:
├── Required: title
├── Recommended: isbn, publisher_id, category_id
├── Optional: description, pages, edition, cover_image_url
└── Conditional: is_digital, format

Copies Table:
├── Required: book_id, barcode, acquisition_date
├── Recommended: condition, location_shelf
└── Optional: notes, last_maintenance_date

Authors Table:
├── Required: first_name OR last_name
├── Optional: biography, birth_date, country
└── Reference: links to books via junction table
```

### Validation Rules

```javascript
// Example validation schema
const bookValidation = {
  title: { required: true, minLength: 1, maxLength: 500 },
  isbn: { 
    required: false, 
    pattern: /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]/,
    unique: true
  },
  pages: { type: 'integer', min: 1, max: 50000 },
  publication_date: { type: 'date', format: 'YYYY-MM-DD' },
  language: { enum: ['English', 'Spanish', 'French', 'German', 'Chinese', ...] }
};
```

---

## Performance Optimization

### Indexing Strategy

```sql
-- Search performance
CREATE INDEX idx_books_title ON books(title COLLATE NOCASE);
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_isbn13 ON books(isbn13);

-- Relationship performance
CREATE INDEX idx_copies_book_id ON copies(book_id);
CREATE INDEX idx_copies_barcode ON copies(barcode);
CREATE INDEX idx_copies_status ON copies(status);
CREATE INDEX idx_book_authors_book_id ON book_authors(book_id);
CREATE INDEX idx_book_keywords_book_id ON book_keywords(book_id);

-- Full-text search
CREATE VIRTUAL TABLE books_fts USING fts5(
  title, description, content='books', content_rowid='id'
);
```

### Query Optimization

1. **Pagination**: Always use LIMIT/OFFSET for list endpoints
2. **Select Specific Columns**: Don't use SELECT *
3. **Eager Loading**: Fetch related data in single query when possible
4. **Caching**: Cache:
   - Frequently accessed categories
   - Publisher lists
   - Author information
5. **Database Pooling**: Use connection pooling with better-sqlite3

### Caching Strategy

```
Level 1: Application Cache (In-Memory)
├── Categories (TTL: 1 hour)
├── Publishers (TTL: 1 hour)
└── Authors (TTL: 30 minutes)

Level 2: Database Cache (external_metadata table)
├── ISBN lookup results (TTL: 30 days)
└── External API responses

Level 3: Browser Cache
└── Static book covers and metadata
```

---

## Security Considerations

### Input Validation
- Sanitize all user inputs
- Validate ISBN format and checksum
- Limit text field lengths
- Validate date formats

### Database Security
- Use parameterized queries (prevent SQL injection)
- Implement row-level access control
- Encrypt sensitive data (future: personal data)
- Maintain audit logs

### API Security
- Implement rate limiting (future: JWT authentication)
- CORS configuration (allow only trusted origins)
- Error messages should not leak database info
- Validate file uploads for digital assets

### Example: Parameterized Queries

```javascript
// ✓ Safe: Using parameters
db.get('SELECT * FROM books WHERE isbn = ?', [userInput]);

// ✗ Unsafe: String concatenation
db.get(`SELECT * FROM books WHERE isbn = '${userInput}'`);
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up SQLite database with schema
- [ ] Initialize Express.js backend
- [ ] Implement basic CRUD endpoints for Books
- [ ] Set up React frontend with book list view

### Phase 2: Core Features (Week 3-4)
- [ ] Implement Authors, Publishers, Categories endpoints
- [ ] Add copy/inventory management
- [ ] Build search functionality
- [ ] Create inventory UI components

### Phase 3: Integration & Enhancement (Week 5-6)
- [ ] Integrate Google Books API
- [ ] Integrate Open Library API
- [ ] Implement bulk import feature
- [ ] Add digital assets support

### Phase 4: Polish & Optimization (Week 7)
- [ ] Add comprehensive error handling
- [ ] Implement caching strategies
- [ ] Performance testing and optimization
- [ ] API documentation (Swagger/OpenAPI)

### Phase 5: Advanced Features (Week 8+)
- [ ] Authentication and authorization
- [ ] Advanced search with filters
- [ ] Reporting and analytics
- [ ] Integration with circulation system

---

## File Structure

```
library-system/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── books.js
│   │   │   ├── authors.js
│   │   │   ├── publishers.js
│   │   │   ├── categories.js
│   │   │   ├── copies.js
│   │   │   └── digital-assets.js
│   │   ├── services/
│   │   │   ├── bookService.js
│   │   │   ├── metadataService.js
│   │   │   ├── googleBooksService.js
│   │   │   ├── openLibraryService.js
│   │   │   └── inventoryService.js
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   ├── validators.js
│   │   │   └── cors.js
│   │   ├── db/
│   │   │   ├── database.js
│   │   │   └── migrations/
│   │   │       └── 001_init_schema.sql
│   │   ├── config/
│   │   │   ├── integrations.js
│   │   │   └── database.js
│   │   └── server.js
│   ├── .env
│   ├── package.json
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BookList.jsx
│   │   │   ├── BookDetail.jsx
│   │   │   ├── BookForm.jsx
│   │   │   ├── InventoryManager.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── pages/
│   │   │   ├── Catalog.jsx
│   │   │   ├── BookDetail.jsx
│   │   │   └── Admin.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   ├── package.json
│   └── tailwind.config.js
│
├── DATABASE_SCHEMA.sql
├── API_DESIGN.md
├── INTEGRATIONS.md
├── EDGE_CASES.md
└── TECHNICAL_DESIGN.md (this file)
```

---

## Getting Started

### 1. Initialize Backend

```bash
cd backend
npm install express cors better-sqlite3 dotenv node-fetch
npm start
```

### 2. Initialize Frontend

```bash
cd frontend
npm install react react-router-dom axios tailwindcss
npm run dev
```

### 3. Create Database

```bash
sqlite3 catalog.db < ../DATABASE_SCHEMA.sql
```

### 4. Configure Environment

Create `.env` file:
```
GOOGLE_BOOKS_API_KEY=your_key_here
OPEN_LIBRARY_TIMEOUT=10000
PREFERRED_METADATA_SOURCE=google_books
DATABASE_PATH=./catalog.db
PORT=5000
```

---

## Success Criteria

✓ Database stores all book metadata and inventory  
✓ REST API provides full CRUD operations  
✓ External APIs successfully populate book data  
✓ Search functionality returns accurate results  
✓ Inventory tracking maintains copy availability  
✓ System handles edge cases gracefully  
✓ Performance acceptable for 100k+ books  
✓ Code is well-documented and maintainable  

---

## References

- [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql) - Complete SQL schema
- [API_DESIGN.md](API_DESIGN.md) - Detailed API documentation
- [INTEGRATIONS.md](INTEGRATIONS.md) - External APIs setup and implementation
- [EDGE_CASES.md](EDGE_CASES.md) - Common edge cases and solutions

---

**Last Updated**: March 27, 2026  
**Version**: 1.0  
**Status**: Ready for Implementation
