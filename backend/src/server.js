const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5173'
    ];
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Cataloging API is running'
  });
});

// API root endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Library System API',
    version: 'v1',
    status: 'OK',
    endpoints: {
      health: '/api/v1/health',
      books: '/api/v1/books',
      searchBooks: '/api/v1/books/search?q=keyword',
      loanPolicies: '/api/v1/circulation/loan-policies',
      dueDateCalculator: '/api/v1/circulation/due-date'
    }
  });
});

// Favicon endpoint (prevent 404 errors)
app.get('/favicon.ico', (req, res) => {
  res.status(204).send();
});

// Import routes (will be created)
const booksRouter = require('./routes/books');
const circulationRouter = require('./routes/circulation');
app.use('/api/v1/books', booksRouter);
app.use('/api/v1/circulation', circulationRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    status: 500
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    status: 404
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ API available at http://localhost:${PORT}/api/v1`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
