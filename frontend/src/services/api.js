import axios from 'axios';

function normalizeApiBaseUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '/api/v1';
  }

  const trimmed = rawValue.replace(/\/+$/, '');
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
  console.warn(
    'VITE_API_BASE_URL is not set. The frontend is using /api/v1 on the current domain. ' +
    'If your backend is deployed separately, set VITE_API_BASE_URL to your backend URL.'
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Books API
export const booksAPI = {
  // Get all books with pagination
  getAll: (page = 1, limit = 20) => 
    api.get(`/books?page=${page}&limit=${limit}`),
  
  // Get book by ID
  getById: (id) => 
    api.get(`/books/${id}`),
  
  // Get book by ISBN
  getByISBN: (isbn) =>
    api.get(`/books/isbn/${isbn}`),
  
  // Create new book
  create: (data) => 
    api.post('/books', data),
  
  // Update book
  update: (id, data) => 
    api.put(`/books/${id}`, data),
  
  // Delete book
  delete: (id) => 
    api.delete(`/books/${id}`),
  
  // Search books
  search: (query, categoryId, limit) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (categoryId) params.append('category_id', categoryId);
    if (limit) params.append('limit', limit);
    return api.get(`/books/search?${params}`);
  }
};

export const circulationAPI = {
  getLoanPolicies: () => api.get('/circulation/loan-policies'),
  calculateDueDate: (itemType, checkoutDate) =>
    api.post('/circulation/due-date', {
      item_type: itemType,
      checkout_date: checkoutDate
    }),
  getLoans: (status = 'Active') => api.get(`/circulation/loans?status=${encodeURIComponent(status)}`),
  checkout: (data) => api.post('/circulation/checkout', data),
  returnLoan: (loanId, returnedDate) =>
    api.post(`/circulation/loans/${loanId}/return`, {
      returned_date: returnedDate
    })
};

export default api;
