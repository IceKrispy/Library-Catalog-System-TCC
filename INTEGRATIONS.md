# External Integrations - ISBN Metadata Services

## Overview
This document outlines the recommended external APIs for automatically fetching book metadata to reduce manual cataloging work.

---

## 1. GOOGLE BOOKS API

### Why Google Books?
- **Pros**: Extensive database (40M+ books), good metadata accuracy, free tier available, well-documented
- **Cons**: Rate limits (100 requests/second), some books may have incomplete metadata
- **Cost**: Free (with rate limits), $1.50 per 1000 requests for commercial use
- **Documentation**: https://developers.google.com/books

### Setup

```bash
# Install required package
npm install node-fetch
```

### Configuration

```javascript
// config/integrations.js
module.exports = {
  googleBooks: {
    baseUrl: 'https://www.googleapis.com/books/v1',
    apiKey: process.env.GOOGLE_BOOKS_API_KEY,
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerDay: 10000
    }
  }
};
```

### Implementation Example

```javascript
// services/googleBooksService.js
const fetch = require('node-fetch');
const config = require('../config/integrations');

class GoogleBooksService {
  async fetchByISBN(isbn) {
    const query = `isbn:${isbn}`;
    const url = `${config.googleBooks.baseUrl}/volumes?q=${encodeURIComponent(query)}&key=${config.googleBooks.apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        return {
          title: volumeInfo.title,
          authors: volumeInfo.authors || [],
          publisher: volumeInfo.publisher,
          publication_date: volumeInfo.publishedDate,
          description: volumeInfo.description,
          pages: volumeInfo.pageCount,
          language: volumeInfo.language,
          cover_image_url: volumeInfo.imageLinks?.thumbnail,
          isbn10: this.extractISBN(volumeInfo.industryIdentifiers, 'ISBN_10'),
          isbn13: this.extractISBN(volumeInfo.industryIdentifiers, 'ISBN_13'),
          categories: volumeInfo.categories || [],
          source: 'google_books'
        };
      }
      return null;
    } catch (error) {
      console.error('Google Books API error:', error);
      throw error;
    }
  }

  extractISBN(identifiers, type) {
    if (!identifiers) return null;
    const identifier = identifiers.find(id => id.type === type);
    return identifier ? identifier.identifier : null;
  }

  async fetchByTitle(title, author = null) {
    let query = `intitle:${title}`;
    if (author) {
      query += ` inauthor:${author}`;
    }
    return this.fetchByQuery(query);
  }

  async fetchByQuery(query) {
    const url = `${config.googleBooks.baseUrl}/volumes?q=${encodeURIComponent(query)}&key=${config.googleBooks.apiKey}&maxResults=10`;
    const response = await fetch(url);
    const data = await response.json();
    return data.items || [];
  }
}

module.exports = new GoogleBooksService();
```

### API Response Example

```json
{
  "kind": "books#volume",
  "etag": "xtIUXC9rJDg",
  "id": "uyLnPgAACAAJ",
  "volumeInfo": {
    "title": "The Great Gatsby",
    "authors": ["F. Scott Fitzgerald"],
    "publisher": "Scribner",
    "publishedDate": "1925-04-10",
    "description": "The classic American novel...",
    "industryIdentifiers": [
      {"type": "ISBN_10", "identifier": "0743273567"},
      {"type": "ISBN_13", "identifier": "9780743273565"}
    ],
    "pageCount": 180,
    "printType": "BOOK",
    "categories": ["Fiction"],
    "language": "en",
    "imageLinks": {
      "smallThumbnail": "http://books.google.com/books/content?id=...",
      "thumbnail": "http://books.google.com/books/content?id=..."
    }
  }
}
```

---

## 2. OPEN LIBRARY API

### Why Open Library?
- **Pros**: Free to use, no API key required, open-source, accurate for classic books
- **Cons**: Slower response times, fewer recent books, less consistent metadata
- **Cost**: Free (no rate limits, but requests may be slow)
- **Documentation**: https://openlibrary.org/developers/api

### Setup

```bash
# No external dependencies needed (uses native fetch)
```

### Configuration

```javascript
// config/integrations.js - add to existing
module.exports = {
  openLibrary: {
    baseUrl: 'https://openlibrary.org/api',
    searchBaseUrl: 'https://openlibrary.org/search.json',
    booksBaseUrl: 'https://openlibrary.org/works',
    timeout: 10000
  }
};
```

### Implementation Example

```javascript
// services/openLibraryService.js
const fetch = require('node-fetch');
const config = require('../config/integrations');

class OpenLibraryService {
  async fetchByISBN(isbn) {
    const url = `${config.openLibrary.baseUrl}/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

    try {
      const response = await fetch(url, { timeout: config.openLibrary.timeout });
      const data = await response.json();

      const key = `ISBN:${isbn}`;
      if (data[key]) {
        return this.parseBookData(data[key]);
      }
      return null;
    } catch (error) {
      console.error('Open Library API error:', error);
      throw error;
    }
  }

  async fetchByTitle(title, author = null) {
    let query = title;
    if (author) {
      query += ` author:${author}`;
    }

    const url = `${config.openLibrary.searchBaseUrl}?title=${encodeURIComponent(query)}&limit=10`;

    try {
      const response = await fetch(url, { timeout: config.openLibrary.timeout });
      const data = await response.json();
      return (data.docs || []).map(doc => this.parseSearchResult(doc));
    } catch (error) {
      console.error('Open Library search error:', error);
      throw error;
    }
  }

  parseBookData(bookData) {
    return {
      title: bookData.title,
      authors: (bookData.authors || []).map(a => a.name),
      publisher: bookData.publishers?.[0]?.name,
      publication_date: bookData.publish_date,
      description: bookData.excerpt?.value || bookData.description,
      pages: bookData.number_of_pages,
      language: 'English',
      cover_image_url: bookData.cover?.medium,
      isbn10: bookData.isbn?.[0],
      isbn13: bookData.isbn?.[1],
      source: 'open_library'
    };
  }

  parseSearchResult(doc) {
    return {
      title: doc.title,
      authors: doc.author_name || [],
      publisher: doc.publisher?.[0],
      publication_date: doc.first_publish_year?.toString(),
      pages: doc.number_of_pages_median,
      language: doc.language?.[0] || 'English',
      isbn10: doc.isbn?.[0],
      isbn13: doc.isbn?.[1],
      source: 'open_library'
    };
  }
}

module.exports = new OpenLibraryService();
```

### API Response Example

```json
{
  "ISBN:9780743273565": {
    "publishers": [
      { "name": "Scribner" }
    ],
    "title": "The Great Gatsby",
    "languages": ["English"],
    "key": "/works/OL15938614W",
    "authors": [
      {
        "name": "F. Scott Fitzgerald",
        "key": "/authors/OL26398A"
      }
    ],
    "publish_date": "April 10, 1925",
    "isbn": ["0743273567", "9780743273565"],
    "cover": {
      "small": "https://covers.openlibrary.org/b/id/...-S.jpg",
      "medium": "https://covers.openlibrary.org/b/id/...-M.jpg"
    }
  }
}
```

---

## 3. COMPARISON & RECOMMENDATION

| Feature | Google Books | Open Library |
|---------|--------------|--------------|
| Coverage | 40M+ books | 2M+ books |
| API Key Required | Yes | No |
| Free Tier | Yes | Yes |
| Rate Limits | Yes (100 req/sec) | No |
| Metadata Accuracy | High | Medium-High |
| Response Time | Fast | Slow |
| Recent Books | Excellent | Good |
| Classic Books | Excellent | Excellent |
| Cost at Scale | $1.50/1000 | Free |

**Recommendation**: Use **dual approach**:
1. Try **Google Books** first (faster, more metadata)
2. Fall back to **Open Library** on failure (free, no rate limits)

---

## 4. INTEGRATION SERVICE

Create a unified service that abstracts both providers:

```javascript
// services/metadataService.js
const googleBooksService = require('./googleBooksService');
const openLibraryService = require('./openLibraryService');

class MetadataService {
  async fetchByISBN(isbn, preferredSource = 'google_books') {
    try {
      if (preferredSource === 'google_books') {
        const data = await googleBooksService.fetchByISBN(isbn);
        if (data) return data;
        // Fall back to Open Library if Google Books fails
        return await openLibraryService.fetchByISBN(isbn);
      } else {
        const data = await openLibraryService.fetchByISBN(isbn);
        if (data) return data;
        // Fall back to Google Books if Open Library fails
        return await googleBooksService.fetchByISBN(isbn);
      }
    } catch (error) {
      console.error('Metadata fetch error:', error);
      return null;
    }
  }

  async fetchByTitle(title, author = null) {
    try {
      const googleResults = await googleBooksService.fetchByTitle(title, author);
      const openResults = await openLibraryService.fetchByTitle(title, author);
      // Merge and deduplicate results
      return this.deduplicateResults([...googleResults, ...openResults]);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(item => {
      const key = `${item.title}-${item.authors?.[0] || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = new MetadataService();
```

---

## 5. EXPRESS ROUTE IMPLEMENTATION

```javascript
// routes/catalogRoutes.js
const express = require('express');
const router = express.Router();
const metadataService = require('../services/metadataService');
const dbService = require('../services/dbService');

// Fetch metadata from external API and create book
router.post('/books/from-isbn', async (req, res) => {
  try {
    const { isbn, category_id } = req.body;

    // Fetch metadata from external APIs
    const metadata = await metadataService.fetchByISBN(isbn);
    if (!metadata) {
      return res.status(404).json({
        error: 'Book not found in external databases',
        status: 404
      });
    }

    // Check if book already exists
    const existing = await dbService.getBookByISBN(isbn);
    if (existing) {
      return res.status(409).json({
        error: 'Book already exists in catalog',
        book_id: existing.id,
        status: 409
      });
    }

    // Create book entry with fetched metadata
    const book = await dbService.createBook({
      title: metadata.title,
      isbn: metadata.isbn10,
      isbn13: metadata.isbn13,
      publisher_id: await dbService.getOrCreatePublisher(metadata.publisher),
      category_id: category_id || 1,
      publication_date: metadata.publication_date,
      description: metadata.description,
      pages: metadata.pages,
      language: metadata.language,
      cover_image_url: metadata.cover_image_url,
      authors: metadata.authors
    });

    res.status(201).json({
      id: book.id,
      title: book.title,
      message: 'Book created from external metadata',
      source: metadata.source
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch and create book',
      message: error.message,
      status: 500
    });
  }
});

module.exports = router;
```

---

## 6. ENVIRONMENT VARIABLES

```bash
# .env file
GOOGLE_BOOKS_API_KEY=your_api_key_here
OPEN_LIBRARY_TIMEOUT=10000
PREFERRED_METADATA_SOURCE=google_books
```

---

## 7. CACHING STRATEGY

To minimize API calls and improve performance:

```javascript
// services/metadataCache.js
class MetadataCache {
  constructor(database) {
    this.db = database;
  }

  async getCached(isbn) {
    return await this.db.get(
      'SELECT metadata_json FROM external_metadata WHERE isbn = ?',
      [isbn]
    );
  }

  async cache(isbn, metadata, source) {
    await this.db.run(
      `INSERT OR REPLACE INTO external_metadata (isbn, source, metadata_json)
       VALUES (?, ?, ?)`,
      [isbn, source, JSON.stringify(metadata)]
    );
  }

  async isCacheExpired(isbn, maxAgeHours = 30 * 24) {
    const cached = await this.getCached(isbn);
    if (!cached) return true;
    
    const ageHours = (Date.now() - new Date(cached.last_updated)) / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }
}

module.exports = MetadataCache;
```

---

## 8. ERROR HANDLING & FALLBACKS

```javascript
// Robust metadata fetching with fallbacks
async function fetchMetadataWithFallbacks(isbn) {
  const cache = new MetadataCache(db);

  // Check cache first
  const cached = await cache.getCached(isbn);
  if (cached && !await cache.isCacheExpired(isbn)) {
    return JSON.parse(cached.metadata_json);
  }

  // Try primary source
  try {
    const data = await metadataService.fetchByISBN(isbn, 'google_books');
    if (data) {
      await cache.cache(isbn, data, data.source);
      return data;
    }
  } catch (error) {
    console.warn('Google Books failed, trying Open Library:', error.message);
  }

  // Try secondary source
  try {
    const data = await metadataService.fetchByISBN(isbn, 'open_library');
    if (data) {
      await cache.cache(isbn, data, data.source);
      return data;
    }
  } catch (error) {
    console.error('All metadata sources failed:', error);
    throw new Error('Unable to fetch book metadata from any source');
  }
}
```
