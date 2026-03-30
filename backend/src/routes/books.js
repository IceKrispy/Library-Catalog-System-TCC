const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/v1/books - Get all books with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get paginated books with related info
    const books = db.prepare(
      `SELECT b.id, b.title, b.isbn, b.isbn13, b.format, b.pages, b.publication_date,
              p.name as publisher_name,
              c.name as category_name,
              COUNT(DISTINCT cp.id) as total_copies,
              SUM(CASE WHEN cp.status = 'Available' THEN 1 ELSE 0 END) as available_copies
       FROM books b
       LEFT JOIN publishers p ON b.publisher_id = p.id
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN copies cp ON b.id = cp.book_id
       GROUP BY b.id
       ORDER BY b.title
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    // Get total count
    const countResult = db.prepare('SELECT COUNT(*) as count FROM books').get();
    const total = countResult.count;

    res.json({
      data: books,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ 
      error: 'Failed to fetch books',
      message: error.message,
      status: 500 
    });
  }
});

// POST /api/v1/books - Create a new book
router.post('/', (req, res) => {
  try {
    const { title, isbn, isbn13, publisher_id, category_id, publication_date, description, pages, language, format, is_digital, cover_image_url } = req.body;

    // Validate required fields
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        error: 'Validation error',
        message: 'Title is required',
        status: 400 
      });
    }

    // Check for duplicate ISBN if provided
    if (isbn) {
      const existing = db.prepare('SELECT id FROM books WHERE isbn = ? OR isbn13 = ?').get(isbn, isbn13);
      if (existing) {
        return res.status(409).json({ 
          error: 'Conflict',
          message: 'ISBN already exists in catalog',
          status: 409 
        });
      }
    }

    // Insert new book
    const result = db.prepare(
      `INSERT INTO books (title, isbn, isbn13, publisher_id, category_id, publication_date, description, pages, language, format, is_digital, cover_image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title,
      isbn || null,
      isbn13 || null,
      publisher_id || null,
      category_id || null,
      publication_date || null,
      description || null,
      pages || null,
      language || 'English',
      format || 'Hardcover',
      is_digital ? 1 : 0,
      cover_image_url || null
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      title,
      message: 'Book created successfully'
    });
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({ 
      error: 'Failed to create book',
      message: error.message,
      status: 500 
    });
  }
});

// GET /api/v1/books/isbn/:isbn - Get book by ISBN
router.get('/isbn/:isbn', (req, res) => {
  try {
    const isbn = req.params.isbn;

    const book = db.prepare(
      `SELECT b.*, p.name as publisher_name, c.name as category_name
       FROM books b
       LEFT JOIN publishers p ON b.publisher_id = p.id
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.isbn = ? OR b.isbn13 = ?`
    ).get(isbn, isbn);

    if (!book) {
      return res.status(404).json({ 
        error: 'Not found',
        message: `Book with ISBN ${isbn} not found`,
        status: 404 
      });
    }

    res.json(book);
  } catch (error) {
    console.error('Error fetching book by ISBN:', error);
    res.status(500).json({ 
      error: 'Failed to fetch book',
      message: error.message,
      status: 500 
    });
  }
});

// PUT /api/v1/books/:id - Update a book
router.put('/:id', (req, res) => {
  try {
    const bookId = req.params.id;
    const { title, description, pages, publication_date, language, format, cover_image_url } = req.body;

    // Verify book exists
    const existing = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
    if (!existing) {
      return res.status(404).json({ 
        error: 'Not found',
        message: `Book with id ${bookId} not found`,
        status: 404 
      });
    }

    // Update book
    db.prepare(
      `UPDATE books 
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           pages = COALESCE(?, pages),
           publication_date = COALESCE(?, publication_date),
           language = COALESCE(?, language),
           format = COALESCE(?, format),
           cover_image_url = COALESCE(?, cover_image_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(title, description, pages, publication_date, language, format, cover_image_url, bookId);

    res.json({
      id: bookId,
      message: 'Book updated successfully'
    });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ 
      error: 'Failed to update book',
      message: error.message,
      status: 500 
    });
  }
});

// DELETE /api/v1/books/:id - Delete a book
router.delete('/:id', (req, res) => {
  try {
    const bookId = req.params.id;

    // Verify book exists
    const existing = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
    if (!existing) {
      return res.status(404).json({ 
        error: 'Not found',
        message: `Book with id ${bookId} not found`,
        status: 404 
      });
    }

    // Delete the book (cascading deletes will handle copies, etc.)
    db.prepare('DELETE FROM books WHERE id = ?').run(bookId);

    res.json({
      message: 'Book deleted successfully',
      id: bookId
    });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ 
      error: 'Failed to delete book',
      message: error.message,
      status: 500 
    });
  }
});

// GET /api/v1/books/search?q=... - Search books
router.get('/search', (req, res) => {
  try {
    const { q, category_id, limit = 20 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ 
        error: 'Validation error',
        message: 'Search query (q) is required',
        status: 400 
      });
    }

    const searchTerm = `%${q}%`;
    
    let query = `SELECT b.id, b.title, b.isbn, b.isbn13, b.format, b.pages, p.name as publisher_name
                 FROM books b
                 LEFT JOIN publishers p ON b.publisher_id = p.id
                 WHERE (b.title LIKE ? OR b.description LIKE ? OR b.isbn LIKE ?)`;
    let params = [searchTerm, searchTerm, q];

    if (category_id) {
      query += ` AND b.category_id = ?`;
      params.push(category_id);
    }

    query += ` LIMIT ?`;
    params.push(parseInt(limit));

    const results = db.prepare(query).all(...params);

    res.json({
      data: results,
      total: results.length
    });
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ 
      error: 'Failed to search books',
      message: error.message,
      status: 500 
    });
  }
});

// GET /api/v1/books/:id - Get single book by ID
router.get('/:id', (req, res) => {
  try {
    const bookId = req.params.id;

    // Keep this catch-all parameterized route after the specific paths above.
    const book = db.prepare(
      `SELECT b.*, p.name as publisher_name, c.name as category_name
       FROM books b
       LEFT JOIN publishers p ON b.publisher_id = p.id
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`
    ).get(bookId);

    if (!book) {
      return res.status(404).json({
        error: 'Not found',
        message: `Book with id ${bookId} not found`,
        status: 404
      });
    }

    const authors = db.prepare(
      `SELECT a.id, a.first_name, a.last_name, ba.author_order, ba.role
       FROM authors a
       JOIN book_authors ba ON a.id = ba.author_id
       WHERE ba.book_id = ?
       ORDER BY ba.author_order`
    ).all(bookId);

    const copies = db.prepare(
      `SELECT id, barcode, copy_number, status, condition, acquisition_date, location_shelf, location_rack
       FROM copies
       WHERE book_id = ?
       ORDER BY copy_number`
    ).all(bookId);

    const keywords = db.prepare(
      `SELECT k.id, k.keyword
       FROM keywords k
       JOIN book_keywords bk ON k.id = bk.keyword_id
       WHERE bk.book_id = ?`
    ).all(bookId);

    const digitalAssets = db.prepare(
      `SELECT id, asset_type, file_size, mime_type, drm_protected
       FROM digital_assets
       WHERE book_id = ?`
    ).all(bookId);

    res.json({
      ...book,
      authors,
      copies,
      keywords,
      digital_assets: digitalAssets,
      is_digital: book.is_digital === 1
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({
      error: 'Failed to fetch book',
      message: error.message,
      status: 500
    });
  }
});

module.exports = router;
