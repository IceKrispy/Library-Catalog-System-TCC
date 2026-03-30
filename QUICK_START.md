# Quick Start Guide - Cataloging System Implementation

This guide walks you through setting up the Library Management System's Cataloging subsystem step by step.

---

## Prerequisites

Ensure you have installed:
- **Node.js** (v16+) and npm
- No database installation required
- **Git** (optional, for version control)

---

## Step 1: Project Structure Setup

```bash
# Create project directories
mkdir -p library-system/{backend,frontend,docs}
cd library-system

# Copy the provided SQL schema and markdown files
# DATABASE_SCHEMA.sql → docs/DATABASE_SCHEMA.sql
# API_DESIGN.md → docs/API_DESIGN.md
# INTEGRATIONS.md → docs/INTEGRATIONS.md
# EDGE_CASES.md → docs/EDGE_CASES.md
# TECHNICAL_DESIGN.md → docs/TECHNICAL_DESIGN.md
```

---

## Step 2: Backend Setup

### 2.1 Initialize Node.js Project

```bash
cd backend
npm init -y
```

### 2.2 Install Dependencies

```bash
npm install express cors dotenv node-fetch
npm install --save-dev nodemon
```

### 2.3 Create Project Structure

```bash
mkdir -p src/{routes,services,middleware,db,config}
touch src/server.js .env .gitignore
```

### 2.4 Create Database

```bash
# No schema import is required.
# The backend starts with seeded sample data in memory.
npm start
```

### 2.5 Create Environment File

Create `backend/.env`:
```env
# Database
DATABASE_PATH=../catalog.db

# Server
PORT=5000
NODE_ENV=development

# External APIs
GOOGLE_BOOKS_API_KEY=your_api_key_here
OPEN_LIBRARY_TIMEOUT=10000
PREFERRED_METADATA_SOURCE=google_books

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 2.6 Create Base Express Server

Create `backend/src/server.js`:
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ API available at http://localhost:${PORT}/api/v1`);
});
```

### 2.7 Update package.json

Update the `scripts` section:
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

### 2.8 Create Database Connection Module

Create `backend/src/db/database.js`:
```javascript
const store = require('../data/store');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

module.exports = db;
```

### 2.9 Test Backend

```bash
npm run dev
# Visit http://localhost:5000/api/v1/health in your browser or curl
```

---

## Step 3: Implement First API Endpoint (Books)

### 3.1 Create Books Route

Create `backend/src/routes/books.js`:
```javascript
const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/v1/books
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const books = db.prepare(
      `SELECT b.id, b.title, b.isbn, b.isbn13, b.format, b.pages,
              p.name as publisher,
              COUNT(c.id) as total_copies,
              SUM(CASE WHEN c.status = 'Available' THEN 1 ELSE 0 END) as available_copies
       FROM books b
       LEFT JOIN publishers p ON b.publisher_id = p.id
       LEFT JOIN copies c ON b.id = c.book_id
       GROUP BY b.id
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM books').get().count;

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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/books
router.post('/', (req, res) => {
  try {
    const { title, isbn, publisher_id, category_id, description, pages, language } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = db.prepare(
      `INSERT INTO books (title, isbn, publisher_id, category_id, description, pages, language)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(title, isbn || null, publisher_id || null, category_id || null, description || null, pages || null, language || 'English');

    res.status(201).json({
      id: result.lastInsertRowid,
      title,
      message: 'Book created successfully'
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'ISBN already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// GET /api/v1/books/:id
router.get('/:id', (req, res) => {
  try {
    const book = db.prepare(
      `SELECT b.*, p.name as publisher_name, c.name as category_name
       FROM books b
       LEFT JOIN publishers p ON b.publisher_id = p.id
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`
    ).get(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Get authors
    const authors = db.prepare(
      `SELECT a.* FROM authors a
       JOIN book_authors ba ON a.id = ba.author_id
       WHERE ba.book_id = ? ORDER BY ba.author_order`
    ).all(req.params.id);

    // Get copies
    const copies = db.prepare(
      `SELECT * FROM copies WHERE book_id = ? ORDER BY copy_number`
    ).all(req.params.id);

    res.json({ ...book, authors, copies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 3.2 Register Route in Server

Update `backend/src/server.js`:
```javascript
const booksRouter = require('./routes/books');

// ... after middleware setup ...

app.use('/api/v1/books', booksRouter);
```

### 3.3 Test Endpoint

```bash
# Get all books
curl http://localhost:5000/api/v1/books

# Create a book
curl -X POST http://localhost:5000/api/v1/books \
  -H "Content-Type: application/json" \
  -d '{"title":"The Great Gatsby","isbn":"0743273567"}'

# Get book by ID
curl http://localhost:5000/api/v1/books/1
```

---

## Step 4: Frontend Setup

### 4.1 Initialize React Project

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
```

### 4.2 Install Additional Dependencies

```bash
npm install react-router-dom axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 4.3 Configure Tailwind

Update `frontend/tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 4.4 Update Tailwind CSS

Update `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4.5 Create API Service

Create `frontend/src/services/api.js`:
```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Books API
export const booksAPI = {
  getAll: (page = 1, limit = 20) => 
    api.get(`/books?page=${page}&limit=${limit}`),
  getById: (id) => 
    api.get(`/books/${id}`),
  create: (data) => 
    api.post('/books', data),
  update: (id, data) => 
    api.put(`/books/${id}`, data),
  delete: (id) => 
    api.delete(`/books/${id}`),
};

export default api;
```

### 4.6 Create Book List Component

Create `frontend/src/components/BookList.jsx`:
```javascript
import { useState, useEffect } from 'react';
import { booksAPI } from '../services/api';

export default function BookList() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const response = await booksAPI.getAll(1, 20);
        setBooks(response.data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-red-600 py-8">Error: {error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Library Catalog</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map(book => (
          <div key={book.id} className="border rounded-lg p-4 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">{book.title}</h2>
            <p className="text-gray-600 mb-2">{book.publisher_name}</p>
            <div className="text-sm text-gray-500">
              <p>ISBN: {book.isbn}</p>
              <p>Copies: {book.total_copies}</p>
              <p className="text-green-600 font-semibold">Available: {book.available_copies}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4.7 Update App Component

Update `frontend/src/App.jsx`:
```javascript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BookList from './components/BookList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookList />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 4.8 Start Frontend

```bash
npm run dev
# Visit http://localhost:5173
```

---

## Step 5: Verify Integration

### 5.1 Add Sample Data (Optional)

The schema already includes sample data from the DATABASE_SCHEMA.sql file. You can manipulate it:

```bash
curl http://localhost:5000/api/v1/books
# You should see seeded sample books
```

### 5.2 Test Full Integration

1. Start backend: `npm run dev` (in backend directory)
2. Start frontend: `npm run dev` (in frontend directory)
3. Open http://localhost:5173 in your browser
4. You should see the library catalog with books

---

## Step 6: Implement Additional Endpoints

Follow the same pattern for:
- Authors (`src/routes/authors.js`)
- Publishers (`src/routes/publishers.js`)
- Categories (`src/routes/categories.js`)
- Copies (`src/routes/copies.js`)

Reference the **[API_DESIGN.md](../docs/API_DESIGN.md)** for exact endpoint specifications.

---

## Step 7: Integrate External APIs

When ready to use Google Books or Open Library:

### 7.1 Create Metadata Service

Create `backend/src/services/metadataService.js` (see **[INTEGRATIONS.md](../docs/INTEGRATIONS.md)**)

### 7.2 Add API Key to Environment

Update `.env`:
```env
GOOGLE_BOOKS_API_KEY=YOUR_KEY_FROM_GOOGLE
```

### 7.3 Create Metadata Route

See **[INTEGRATIONS.md](../docs/INTEGRATIONS.md)** for implementation details.

---

## Step 8: Handle Edge Cases

Reference **[EDGE_CASES.md](../docs/EDGE_CASES.md)** for implementation of:
- Duplicate ISBN handling
- Multiple editions
- Multiple authors
- Complete/incomplete metadata
- And more...

---

## Common Commands

### Backend
```bash
cd backend

# Development
npm run dev

# Production
npm start

# API operations
curl http://localhost:5000/api/v1/health
```

### Frontend
```bash
cd frontend

# Development
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

---

## Troubleshooting

### Database Connection Error
```
Error: ENOENT: no such file or directory, open 'catalog.db'
```
**Solution**: Ensure DATABASE_SCHEMA.sql has been run to create the database.

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution**: Check that CORS_ORIGIN in .env matches your frontend URL (typically http://localhost:5173).

### Import Errors
```
Module not found: xyz
```
**Solution**: Run `npm install` first and ensure all dependencies are installed.

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Solution**: Change PORT in .env or kill the process using that port.

---

## Next Steps

1. ✅ Set up backend and frontend
2. ✅ Implement Books endpoint
3. ⬜ Implement remaining CRUD endpoints
4. ⬜ Add search functionality
5. ⬜ Integrate external APIs
6. ⬜ Add authentication (if needed)
7. ⬜ Deploy to production

---

## Documentation Reference

| File | Purpose |
|------|---------|
| [DATABASE_SCHEMA.sql](../docs/DATABASE_SCHEMA.sql) | Complete database schema |
| [API_DESIGN.md](../docs/API_DESIGN.md) | All API endpoints with examples |
| [INTEGRATIONS.md](../docs/INTEGRATIONS.md) | External API setup |
| [EDGE_CASES.md](../docs/EDGE_CASES.md) | Handling edge cases |
| [TECHNICAL_DESIGN.md](../docs/TECHNICAL_DESIGN.md) | Overall architecture |

---

**Happy coding! 🚀**
