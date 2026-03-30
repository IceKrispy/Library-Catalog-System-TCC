import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { booksAPI, circulationAPI } from '../services/api';
import { today } from '../utils/loanPreview';

const emptyForm = {
  title: '',
  isbn: '',
  isbn13: '',
  description: '',
  pages: '',
  publication_date: '',
  language: 'English',
  format: 'Hardcover',
  cover_image_url: ''
};

export default function BookList({ user, onLogout }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'borrowed' ? 'borrowed' : 'dashboard';

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [activeLoans, setActiveLoans] = useState([]);
  const [returningLoanId, setReturningLoanId] = useState(null);

  useEffect(() => {
    loadBooks();
  }, [page]);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadBooks = async (options = {}) => {
    const query = options.query ?? searchQuery.trim();
    const nextPage = options.page ?? page;
    const searchMode = Boolean(query);

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');

      if (searchMode) {
        const response = await booksAPI.search(query);
        setBooks(response.data.data);
        setTotalPages(1);
        setIsSearching(true);
        return;
      }

      const response = await booksAPI.getAll(nextPage, 20);
      setBooks(response.data.data);
      setTotalPages(response.data.pagination.total_pages);
      setIsSearching(false);
    } catch (err) {
      console.error('Error loading books:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  const loadLoans = async () => {
    try {
      const response = await circulationAPI.getLoans('Active');
      setActiveLoans(response.data.data);
    } catch (err) {
      console.error('Error loading loans:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load active loans');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingBookId(null);
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setPage(1);
      await loadBooks({ query: '', page: 1 });
      return;
    }

    await loadBooks({ query: searchQuery.trim(), page: 1 });
  };

  const handleResetSearch = async () => {
    setSearchQuery('');
    setPage(1);
    await loadBooks({ query: '', page: 1 });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage('');

      const payload = {
        ...formData,
        pages: formData.pages ? Number(formData.pages) : null
      };

      if (editingBookId) {
        await booksAPI.update(editingBookId, payload);
        setSuccessMessage('Book updated successfully.');
      } else {
        await booksAPI.create(payload);
        setSuccessMessage('Book added successfully.');
      }

      resetForm();
      setSearchQuery('');
      setPage(1);
      await loadBooks({ query: '', page: 1 });
    } catch (err) {
      console.error('Error saving book:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save book');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (bookId) => {
    try {
      setError(null);
      setSuccessMessage('');

      const response = await booksAPI.getById(bookId);
      const book = response.data;

      setEditingBookId(bookId);
      setFormData({
        title: book.title || '',
        isbn: book.isbn || '',
        isbn13: book.isbn13 || '',
        description: book.description || '',
        pages: book.pages || '',
        publication_date: book.publication_date || '',
        language: book.language || 'English',
        format: book.format || 'Hardcover',
        cover_image_url: book.cover_image_url || ''
      });
      setSearchParams({ view: 'dashboard' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error loading book details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load book details');
    }
  };

  const handleDelete = async (bookId, title) => {
    const confirmed = window.confirm(`Delete "${title}" from the catalog?`);
    if (!confirmed) return;

    try {
      setError(null);
      setSuccessMessage('');
      await booksAPI.delete(bookId);
      setSuccessMessage('Book deleted successfully.');

      if (editingBookId === bookId) {
        resetForm();
      }

      if (books.length === 1 && page > 1 && !isSearching) {
        const previousPage = page - 1;
        setPage(previousPage);
        await loadBooks({ query: '', page: previousPage });
        return;
      }

      await Promise.all([
        loadBooks({ query: isSearching ? searchQuery.trim() : '', page }),
        loadLoans()
      ]);
    } catch (err) {
      console.error('Error deleting book:', err);
      setError(err.response?.data?.message || err.message || 'Failed to delete book');
    }
  };

  const handleReturnLoan = async (loanId) => {
    try {
      setReturningLoanId(loanId);
      setError(null);
      setSuccessMessage('');

      await circulationAPI.returnLoan(loanId, today());
      setSuccessMessage('Loan returned successfully.');
      await Promise.all([
        loadBooks({ query: isSearching ? searchQuery.trim() : '', page }),
        loadLoans()
      ]);
    } catch (err) {
      console.error('Error returning loan:', err);
      setError(err.response?.data?.message || err.message || 'Failed to return loan');
    } finally {
      setReturningLoanId(null);
    }
  };

  const totalBooks = books.length;
  const totalCopies = books.reduce((sum, book) => sum + (book.total_copies || 0), 0);
  const totalAvailableCopies = books.reduce((sum, book) => sum + (book.available_copies || 0), 0);
  const totalBorrowedCopies = Math.max(totalCopies - totalAvailableCopies, 0);

  const statCards = [
    { label: 'Books on Screen', value: totalBooks },
    { label: 'Total Copies', value: totalCopies },
    { label: 'Borrowed Copies', value: totalBorrowedCopies }
  ];

  if (loading && books.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading books...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AppSidebar user={user} onLogout={onLogout} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 rounded-3xl bg-[linear-gradient(135deg,_#1d4ed8,_#0f172a)] p-6 text-white shadow-xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-blue-100">
                    {activeView === 'dashboard' ? 'Catalog Overview' : 'Borrowed Inventory'}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">
                    {activeView === 'dashboard' ? 'Library Dashboard' : 'Borrowed Books'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-blue-100">
                    {activeView === 'dashboard'
                      ? 'Focus on catalog management here, while checkout and due date tools live on their own pages.'
                      : 'Review active loans and return borrowed items from a cleaner, focused view.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSearchParams({ view: activeView === 'dashboard' ? 'borrowed' : 'dashboard' })
                  }
                  className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-blue-50"
                >
                  {activeView === 'dashboard' ? 'Open Borrowed Books' : 'Back to Dashboard'}
                </button>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {statCards.map((card) => (
                <div key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
                </div>
              ))}
            </div>

            {successMessage && (
              <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-green-700">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {activeView === 'dashboard' ? (
              <>
                <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold text-gray-900">
                        {editingBookId ? 'Edit Book' : 'Add Book'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {editingBookId
                          ? 'Update the selected book and save your changes.'
                          : 'Create a new catalog entry with the main book details.'}
                      </p>
                    </div>
                    {editingBookId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
                      <input required name="title" type="text" value={formData.title} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">ISBN</span>
                      <input name="isbn" type="text" value={formData.isbn} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">ISBN-13</span>
                      <input name="isbn13" type="text" value={formData.isbn13} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Pages</span>
                      <input name="pages" type="number" min="1" value={formData.pages} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Publication Date</span>
                      <input name="publication_date" type="date" value={formData.publication_date} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Language</span>
                      <input name="language" type="text" value={formData.language} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Format</span>
                      <select name="format" value={formData.format} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
                        <option value="Hardcover">Hardcover</option>
                        <option value="Paperback">Paperback</option>
                        <option value="E-book">E-book</option>
                        <option value="Audiobook">Audiobook</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Cover Image URL</span>
                      <input name="cover_image_url" type="url" value={formData.cover_image_url} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
                      <textarea name="description" rows="4" value={formData.description} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </label>
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {isSubmitting ? 'Saving...' : editingBookId ? 'Update Book' : 'Add Book'}
                      </button>
                      <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-6 py-2 font-medium text-gray-800 transition hover:bg-gray-300">
                        Clear Form
                      </button>
                    </div>
                  </form>
                </div>

                <div className="mb-8 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Separated Tools</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">Cleaner Workflow</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Checkout is now on its own circulation page, and automated due dates live under settings.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => navigate('/checkout')} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                      Open Checkout Page
                    </button>
                    <button type="button" onClick={() => navigate('/settings')} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                      Open Settings Page
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSearch} className="mb-8">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search books by title, ISBN, or description..." className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700">Search</button>
                    <button type="button" onClick={handleResetSearch} className="rounded-lg bg-gray-300 px-6 py-2 text-gray-800 transition hover:bg-gray-400">Reset</button>
                  </div>
                </form>

                {isSearching && (
                  <div className="mb-4 text-sm text-gray-600">
                    Showing search results for "{searchQuery.trim()}".
                  </div>
                )}

                {books.length === 0 ? (
                  <div className="rounded-2xl bg-white py-12 text-center shadow-sm">
                    <p className="text-xl text-gray-600">No books found.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {books.map((book) => (
                        <div key={book.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                          <div className="p-6">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div>
                                <h2 className="mb-2 text-xl font-semibold text-gray-900">{book.title}</h2>
                                <p className="text-sm text-gray-600">{book.publisher_name || 'Unknown Publisher'}</p>
                              </div>
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                {book.format || 'Unknown Format'}
                              </span>
                            </div>

                            <div className="mb-4 space-y-2 text-sm text-gray-700">
                              {book.isbn && <p>ISBN: {book.isbn}</p>}
                              {book.pages && <p>Pages: {book.pages}</p>}
                              {book.category_name && <p>Category: {book.category_name}</p>}
                              {book.publication_date && <p>Published: {book.publication_date}</p>}
                            </div>

                            <div className="mt-4 border-t border-gray-200 pt-4">
                              <div className="mb-4 flex justify-between">
                                <div>
                                  <p className="text-sm text-gray-600">Total Copies</p>
                                  <p className="text-lg font-bold text-gray-900">{book.total_copies || 0}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">Available</p>
                                  <p className={`text-lg font-bold ${(book.available_copies || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {book.available_copies || 0}
                                  </p>
                                </div>
                              </div>

                              <div className="mb-2 flex gap-2">
                                <button type="button" onClick={() => navigate(`/checkout?bookId=${book.id}`)} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700">
                                  Checkout
                                </button>
                                <button type="button" onClick={() => handleEdit(book.id)} className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-white transition hover:bg-amber-600">
                                  Edit
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleDelete(book.id, book.title)} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700">
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!isSearching && totalPages > 1 && (
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-800 transition hover:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                        <div className="flex items-center gap-2">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (page <= 3) pageNum = i + 1;
                            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = page - 2 + i;

                            return (
                              <button key={pageNum} onClick={() => setPage(pageNum)} className={`rounded-lg px-3 py-2 transition ${page === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'}`}>
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-800 transition hover:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-900">Borrowed Books</h3>
                    <p className="text-sm text-slate-600">Loans are now easier to review separately from book management.</p>
                  </div>
                  <button type="button" onClick={() => setSearchParams({ view: 'dashboard' })} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                    Back to Dashboard
                  </button>
                </div>

                {activeLoans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-600">
                    No active loans are stored yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {activeLoans.map((loan) => (
                      <div key={loan.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-xl font-semibold text-slate-900">{loan.title}</h4>
                            <p className="mt-1 text-sm text-slate-600">Borrower: {loan.borrower_name}</p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {loan.status}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-slate-500">Barcode</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{loan.barcode}</p>
                          </div>
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-slate-500">Item Type</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{loan.item_type}</p>
                          </div>
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-slate-500">Checked Out</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{loan.checkout_date}</p>
                          </div>
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-slate-500">Due Date</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{loan.due_date}</p>
                          </div>
                        </div>

                        <button type="button" onClick={() => handleReturnLoan(loan.id)} disabled={returningLoanId === loan.id} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                          {returningLoanId === loan.id ? 'Returning...' : 'Mark as Returned'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
