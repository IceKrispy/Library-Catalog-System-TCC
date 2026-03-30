const express = require('express');
const store = require('../data/store');

const router = express.Router();

// GET /api/v1/books - Get all books with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await store.listBooks(page, limit);

    res.json(result);
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
router.post('/', async (req, res) => {
  try {
    const {
      title,
      isbn,
      isbn13,
      publisher_id,
      category_id,
      publication_date,
      description,
      pages,
      language,
      format,
      is_digital,
      cover_image_url
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Title is required',
        status: 400
      });
    }

    const createdBook = await store.createBook({
      title,
      isbn,
      isbn13,
      publisher_id,
      category_id,
      publication_date,
      description,
      pages,
      language,
      format,
      is_digital,
      cover_image_url
    });

    res.status(201).json({
      id: createdBook.id,
      title: createdBook.title,
      message: 'Book created successfully'
    });
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(error.status || 500).json({
      error: error.status ? 'Validation error' : 'Failed to create book',
      message: error.message,
      status: error.status || 500
    });
  }
});

// GET /api/v1/books/isbn/:isbn - Get book by ISBN
router.get('/isbn/:isbn', async (req, res) => {
  try {
    const book = await store.getBookByISBN(req.params.isbn);

    if (!book) {
      return res.status(404).json({
        error: 'Not found',
        message: `Book with ISBN ${req.params.isbn} not found`,
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
router.put('/:id', async (req, res) => {
  try {
    const book = await store.updateBook(req.params.id, req.body);

    if (!book) {
      return res.status(404).json({
        error: 'Not found',
        message: `Book with id ${req.params.id} not found`,
        status: 404
      });
    }

    res.json({
      id: String(book.id),
      message: 'Book updated successfully'
    });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(error.status || 500).json({
      error: error.status ? 'Validation error' : 'Failed to update book',
      message: error.message,
      status: error.status || 500
    });
  }
});

// DELETE /api/v1/books/:id - Delete a book
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await store.deleteBook(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not found',
        message: `Book with id ${req.params.id} not found`,
        status: 404
      });
    }

    res.json({
      message: 'Book deleted successfully',
      id: String(req.params.id)
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
router.get('/search', async (req, res) => {
  try {
    const { q, category_id, limit = 20 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Search query (q) is required',
        status: 400
      });
    }

    const result = await store.searchBooks(q, category_id, limit);
    res.json(result);
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
router.get('/:id', async (req, res) => {
  try {
    const book = await store.getBookById(req.params.id);

    if (!book) {
      return res.status(404).json({
        error: 'Not found',
        message: `Book with id ${req.params.id} not found`,
        status: 404
      });
    }

    res.json(book);
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
