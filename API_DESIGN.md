# API Design - Cataloging System

## Base URL
```
http://localhost:5000/api/v1
```

---

## 1. BOOKS ENDPOINTS

### 1.1 Create a New Book
```http
POST /api/v1/books
Content-Type: application/json

{
  "title": "The Great Gatsby",
  "isbn": "0743273567",
  "isbn13": "9780743273565",
  "publisher_id": 1,
  "category_id": 1,
  "publication_date": "1925-04-10",
  "description": "A classic American novel",
  "language": "English",
  "pages": 180,
  "edition": "First Edition",
  "format": "Hardcover",
  "is_digital": false,
  "cover_image_url": "https://example.com/cover.jpg",
  "author_ids": [1, 2],
  "keywords": ["classic", "american", "fiction"]
}

Response: 201 Created
{
  "id": 1,
  "title": "The Great Gatsby",
  "isbn": "0743273567",
  "message": "Book created successfully"
}
```

### 1.2 Fetch All Books (with Pagination & Filters)
```http
GET /api/v1/books?page=1&limit=20&category_id=1&search=gatsby&sort=title

Response: 200 OK
{
  "data": [
    {
      "id": 1,
      "title": "The Great Gatsby",
      "isbn": "0743273567",
      "publisher": { "id": 1, "name": "Scribner" },
      "category": { "id": 1, "name": "Fiction" },
      "authors": [
        { "id": 1, "first_name": "F. Scott", "last_name": "Fitzgerald" }
      ],
      "copies_count": 3,
      "available_copies": 2,
      "format": "Hardcover",
      "pages": 180
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 48,
    "total_pages": 3
  }
}
```

### 1.3 Get a Single Book by ID
```http
GET /api/v1/books/:id

Response: 200 OK
{
  "id": 1,
  "title": "The Great Gatsby",
  "isbn": "0743273567",
  "isbn13": "9780743273565",
  "publisher": { "id": 1, "name": "Scribner" },
  "category": { "id": 1, "name": "Fiction" },
  "authors": [
    { "id": 1, "first_name": "F. Scott", "last_name": "Fitzgerald" }
  ],
  "publication_date": "1925-04-10",
  "description": "A classic American novel",
  "language": "English",
  "pages": 180,
  "edition": "First Edition",
  "format": "Hardcover",
  "is_digital": false,
  "cover_image_url": "https://example.com/cover.jpg",
  "keywords": ["classic", "american", "fiction"],
  "copies": [
    {
      "id": 1,
      "barcode": "BAR-001",
      "copy_number": 1,
      "status": "Available",
      "condition": "Excellent",
      "location_shelf": "A-01-001"
    }
  ],
  "digital_assets": [],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### 1.4 Get Book by ISBN
```http
GET /api/v1/books/isbn/:isbn

Response: 200 OK
{
  "id": 1,
  "title": "The Great Gatsby",
  ... (same structure as above)
}
```

### 1.5 Update a Book
```http
PUT /api/v1/books/:id
Content-Type: application/json

{
  "title": "The Great Gatsby - Updated",
  "description": "Updated description",
  "pages": 182,
  "author_ids": [1, 2, 3],
  "keywords": ["classic", "american", "fiction", "romance"]
}

Response: 200 OK
{
  "id": 1,
  "message": "Book updated successfully"
}
```

### 1.6 Delete a Book
```http
DELETE /api/v1/books/:id

Response: 200 OK
{
  "message": "Book deleted successfully"
}
```

### 1.7 Search Books (Advanced)
```http
GET /api/v1/books/search?q=gatsby&category=fiction&publisher=scribner&author=fitzgerald&language=English

Response: 200 OK
{
  "data": [...],
  "total": 5
}
```

---

## 2. COPIES/INVENTORY ENDPOINTS

### 2.1 Add a Physical Copy
```http
POST /api/v1/books/:id/copies
Content-Type: application/json

{
  "barcode": "BAR-001-NEW",
  "copy_number": 4,
  "acquisition_date": "2024-01-20",
  "cost": 15.99,
  "condition": "Excellent",
  "location_shelf": "A-01-001",
  "location_rack": "Rack-A",
  "notes": "Donated from library foundation"
}

Response: 201 Created
{
  "id": 10,
  "barcode": "BAR-001-NEW",
  "message": "Copy added successfully"
}
```

### 2.2 Get All Copies of a Book
```http
GET /api/v1/books/:id/copies?status=Available

Response: 200 OK
{
  "data": [
    {
      "id": 1,
      "barcode": "BAR-001",
      "copy_number": 1,
      "status": "Available",
      "condition": "Excellent",
      "acquisition_date": "2023-01-15",
      "location_shelf": "A-01-001",
      "last_maintenance_date": "2024-01-10"
    }
  ]
}
```

### 2.3 Update Copy Status & Location
```http
PATCH /api/v1/copies/:copy_id
Content-Type: application/json

{
  "status": "Checked Out",
  "location_shelf": "Checkout-Counter",
  "last_maintenance_date": "2024-01-20"
}

Response: 200 OK
{
  "id": 1,
  "message": "Copy updated successfully"
}
```

### 2.4 Get Copy by Barcode
```http
GET /api/v1/copies/barcode/:barcode

Response: 200 OK
{
  "id": 1,
  "book_id": 1,
  "barcode": "BAR-001",
  "copy_number": 1,
  "status": "Available",
  "condition": "Excellent",
  "book": {
    "id": 1,
    "title": "The Great Gatsby",
    "isbn": "0743273567"
  }
}
```

### 2.5 Delete a Copy
```http
DELETE /api/v1/copies/:copy_id

Response: 200 OK
{
  "message": "Copy deleted successfully"
}
```

---

## 3. AUTHORS ENDPOINTS

### 3.1 Create an Author
```http
POST /api/v1/authors
Content-Type: application/json

{
  "first_name": "F. Scott",
  "last_name": "Fitzgerald",
  "biography": "American novelist and short story writer",
  "birth_date": "1896-09-24",
  "country": "United States"
}

Response: 201 Created
{
  "id": 1,
  "first_name": "F. Scott",
  "last_name": "Fitzgerald",
  "message": "Author created successfully"
}
```

### 3.2 Get All Authors
```http
GET /api/v1/authors?page=1&limit=20

Response: 200 OK
{
  "data": [
    {
      "id": 1,
      "first_name": "F. Scott",
      "last_name": "Fitzgerald",
      "birth_date": "1896-09-24",
      "country": "United States",
      "books_count": 15
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150 }
}
```

### 3.3 Get Single Author
```http
GET /api/v1/authors/:id

Response: 200 OK
{
  "id": 1,
  "first_name": "F. Scott",
  "last_name": "Fitzgerald",
  "biography": "American novelist...",
  "birth_date": "1896-09-24",
  "country": "United States",
  "books": [
    { "id": 1, "title": "The Great Gatsby", "publication_date": "1925-04-10" }
  ]
}
```

### 3.4 Update an Author
```http
PUT /api/v1/authors/:id
Content-Type: application/json

{
  "biography": "Updated biography",
  "country": "United States"
}

Response: 200 OK
{
  "id": 1,
  "message": "Author updated successfully"
}
```

### 3.5 Delete an Author
```http
DELETE /api/v1/authors/:id

Response: 200 OK
{
  "message": "Author deleted successfully"
}
```

---

## 4. PUBLISHERS ENDPOINTS

### 4.1 Create a Publisher
```http
POST /api/v1/publishers
Content-Type: application/json

{
  "name": "Scribner",
  "address": "1230 Avenue of the Americas",
  "city": "New York",
  "country": "United States",
  "email": "info@scribner.com",
  "phone": "+1-212-555-0100",
  "website": "www.scribner.com"
}

Response: 201 Created
{
  "id": 1,
  "name": "Scribner",
  "message": "Publisher created successfully"
}
```

### 4.2 Get All Publishers
```http
GET /api/v1/publishers?page=1&limit=50

Response: 200 OK
{
  "data": [
    {
      "id": 1,
      "name": "Scribner",
      "city": "New York",
      "country": "United States",
      "books_count": 45
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 120 }
}
```

### 4.3 Get Single Publisher
```http
GET /api/v1/publishers/:id

Response: 200 OK
{
  "id": 1,
  "name": "Scribner",
  "address": "1230 Avenue of the Americas",
  "city": "New York",
  "country": "United States",
  "email": "info@scribner.com",
  "phone": "+1-212-555-0100",
  "website": "www.scribner.com",
  "books": [
    { "id": 1, "title": "The Great Gatsby" }
  ]
}
```

### 4.4 Update a Publisher
```http
PUT /api/v1/publishers/:id

Response: 200 OK
{
  "id": 1,
  "message": "Publisher updated successfully"
}
```

### 4.5 Delete a Publisher
```http
DELETE /api/v1/publishers/:id

Response: 200 OK
{
  "message": "Publisher deleted successfully"
}
```

---

## 5. CATEGORIES ENDPOINTS

### 5.1 Create a Category
```http
POST /api/v1/categories
Content-Type: application/json

{
  "name": "Science Fiction",
  "description": "Science fiction novels and stories",
  "parent_category_id": null
}

Response: 201 Created
{
  "id": 3,
  "name": "Science Fiction",
  "message": "Category created successfully"
}
```

### 5.2 Get All Categories (with Hierarchy)
```http
GET /api/v1/categories

Response: 200 OK
{
  "data": [
    {
      "id": 1,
      "name": "Fiction",
      "description": "Fictional works",
      "parent_category_id": null,
      "subcategories": [
        {
          "id": 2,
          "name": "Fantasy",
          "parent_category_id": 1
        }
      ]
    }
  ]
}
```

### 5.3 Get Single Category
```http
GET /api/v1/categories/:id

Response: 200 OK
{
  "id": 1,
  "name": "Fiction",
  "description": "Fictional works",
  "parent_category_id": null,
  "books_count": 250
}
```

### 5.4 Update a Category
```http
PUT /api/v1/categories/:id

Response: 200 OK
{
  "id": 1,
  "message": "Category updated successfully"
}
```

### 5.5 Delete a Category
```http
DELETE /api/v1/categories/:id

Response: 200 OK
{
  "message": "Category deleted successfully (subcategories preserved)"
}
```

---

## 6. DIGITAL ASSETS ENDPOINTS

### 6.1 Add Digital Asset (E-book, Audiobook, etc.)
```http
POST /api/v1/books/:id/digital-assets
Content-Type: application/json

{
  "asset_type": "E-book",
  "file_path": "/assets/ebooks/gatsby.epub",
  "file_size": 2048576,
  "mime_type": "application/epub+zip",
  "license_type": "Single User License",
  "expiration_date": "2025-01-15",
  "drm_protected": true,
  "downloads_allowed": 5
}

Response: 201 Created
{
  "id": 1,
  "asset_type": "E-book",
  "message": "Digital asset added successfully"
}
```

### 6.2 Get Digital Assets for a Book
```http
GET /api/v1/books/:id/digital-assets

Response: 200 OK
{
  "data": [
    {
      "id": 1,
      "asset_type": "E-book",
      "file_size": 2048576,
      "mime_type": "application/epub+zip",
      "drm_protected": true,
      "downloads_allowed": 5
    }
  ]
}
```

### 6.3 Update Digital Asset
```http
PATCH /api/v1/digital-assets/:asset_id

Response: 200 OK
{
  "id": 1,
  "message": "Digital asset updated successfully"
}
```

### 6.4 Delete Digital Asset
```http
DELETE /api/v1/digital-assets/:asset_id

Response: 200 OK
{
  "message": "Digital asset deleted successfully"
}
```

---

## 7. EXTERNAL API INTEGRATION ENDPOINTS

### 7.1 Fetch Book Metadata by ISBN
```http
POST /api/v1/books/fetch-metadata
Content-Type: application/json

{
  "isbn": "978-0-7432-7356-5"
}

Response: 200 OK
{
  "title": "The Great Gatsby",
  "isbn": "0743273567",
  "isbn13": "978-0-7432-7356-5",
  "authors": ["F. Scott Fitzgerald"],
  "publisher": "Scribner",
  "publication_date": "1925-04-10",
  "description": "A classic American novel...",
  "pages": 180,
  "language": "English",
  "cover_image_url": "https://...",
  "source": "google_books"
}
```

### 7.2 Bulk Import Books from ISBN List
```http
POST /api/v1/books/bulk-import
Content-Type: application/json

{
  "isbns": ["978-0-7432-7356-5", "978-0-553-10354-0"],
  "category_id": 1,
  "source": "google_books"
}

Response: 202 Accepted
{
  "job_id": "bulk-import-2024-01-15-001",
  "status": "Processing",
  "message": "Bulk import started. Check status with job_id"
}
```

### 7.3 Check Bulk Import Status
```http
GET /api/v1/books/bulk-import/:job_id

Response: 200 OK
{
  "job_id": "bulk-import-2024-01-15-001",
  "status": "Completed",
  "processed": 2,
  "imported": 2,
  "failed": 0,
  "errors": []
}
```

---

## 8. ERROR RESPONSES

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid input: title is required",
  "status": 400
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Book with id 999 not found",
  "status": 404
}
```

### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "ISBN must be unique. This ISBN already exists.",
  "status": 409
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "status": 500
}
```

---

## 9. COMMON QUERY PARAMETERS

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | integer | Pagination page number | `?page=2` |
| `limit` | integer | Items per page (max 100) | `?limit=20` |
| `sort` | string | Sort field (ascending/descending) | `?sort=-created_at` |
| `search` | string | Full-text search query | `?search=gatsby` |
| `category_id` | integer | Filter by category | `?category_id=1` |
| `status` | string | Filter copies by status | `?status=Available` |
| `is_digital` | boolean | Filter digital vs physical | `?is_digital=true` |
| `language` | string | Filter by language | `?language=English` |

---

## 10. RESPONSE HEADERS
```
Content-Type: application/json
X-Total-Count: 150
X-Page-Count: 8
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
```

---

## 11. AUTHENTICATION (Future Implementation)
```
Authorization: Bearer <jwt_token>
```
All protected endpoints require a valid JWT token in the Authorization header.
