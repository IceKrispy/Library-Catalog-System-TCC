const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const booksRouter = require('./routes/books');
const circulationRouter = require('./routes/circulation');
const { hasSupabaseConfig, getSupabaseConfigStatus } = require('./lib/supabase');

const app = express();

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return /^https:\/\/.+\.vercel\.app$/i.test(origin);
}

const configuredOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  ...configuredOrigins
];

app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/', (req, res) => {
  res.json({
    name: 'Library System API',
    status: 'OK',
    message: 'Backend is running',
    endpoints: {
      root: '/',
      api: '/api/v1',
      health: '/api/v1/health'
    }
  });
});

app.get('/api/v1/health', (req, res) => {
  const configStatus = getSupabaseConfigStatus();

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Cataloging API is running',
    databaseConfigured: hasSupabaseConfig(),
    config: configStatus
  });
});

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

app.get('/favicon.ico', (req, res) => {
  res.status(204).send();
});

app.use('/api/v1/books', booksRouter);
app.use('/api/v1/circulation', circulationRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    status: 500
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    status: 404
  });
});

module.exports = app;
