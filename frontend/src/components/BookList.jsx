import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { booksAPI, circulationAPI } from '../services/api';
import { today } from '../utils/loanPreview';

const emptyForm = {
  title: '',
  isbn: '',
  isbn13: '',
  authors: '',
  copy_count: '0',
  additional_copies: '0',
  description: '',
  pages: '',
  publication_date: '',
  language: 'English',
  format: 'Hardcover',
  cover_image_url: ''
};

const initialFilters = {
  format: 'all',
  availability: 'all',
  language: 'all'
};

const sortOptions = [
  { key: 'title', label: 'Title' },
  { key: 'publication_date', label: 'Publication Date' },
  { key: 'format', label: 'Format' },
  { key: 'language', label: 'Language' },
  { key: 'available_copies', label: 'Availability' }
];

function getAvailabilityLabel(book) {
  const totalCopies = Number(
    book.total_copies ?? (Array.isArray(book.copies) ? book.copies.length : 0)
  );
  const availableCopies = Number(
    book.available_copies ??
      (Array.isArray(book.copies)
        ? book.copies.filter((copy) => copy.status === 'Available').length
        : 0)
  );

  if (totalCopies === 0) {
    return 'No copies';
  }

  return availableCopies > 0 ? 'Available' : 'Borrowed';
}

function getAvailabilityBadgeClasses(book) {
  const label = getAvailabilityLabel(book);

  if (label === 'Available') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (label === 'Borrowed') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-600';
}

function formatDisplayDate(value) {
  if (!value) {
    return 'Unknown';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function compareValues(left, right) {
  if (left === right) {
    return 0;
  }

  if (left === null || left === undefined || left === '') {
    return 1;
  }

  if (right === null || right === undefined || right === '') {
    return -1;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function getAuthorLabel(authors) {
  if (!Array.isArray(authors) || authors.length === 0) {
    return 'Unknown author';
  }

  return authors
    .map((author) => `${author.first_name || ''} ${author.last_name || ''}`.trim())
    .filter(Boolean)
    .join(', ');
}

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
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });
  const [selectedBook, setSelectedBook] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCopyId, setSelectedCopyId] = useState(null);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);

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
    setIsAddBookOpen(false);
  };

  const clearFormFields = () => {
    if (editingBookId) {
      setFormData((current) => ({
        ...current,
        title: '',
        isbn: '',
        isbn13: '',
        authors: '',
        additional_copies: '0',
        description: '',
        pages: '',
        publication_date: '',
        language: 'English',
        format: 'Hardcover',
        cover_image_url: ''
      }));
      return;
    }

    setFormData(emptyForm);
  };

  const handleOpenAddBook = () => {
    setError(null);
    setSuccessMessage('');
    setEditingBookId(null);
    setFormData(emptyForm);
    setIsAddBookOpen(true);
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

    if (name === 'copy_count' || name === 'additional_copies') {
      const normalizedValue = value === '' ? '0' : String(Math.max(0, Number(value) || 0));
      setFormData((current) => ({ ...current, [name]: normalizedValue }));
      return;
    }

    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const clearFilters = () => {
    setFilters(initialFilters);
  };

  const handleSortChange = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
      }

      return { key, direction: 'asc' };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage('');

      const payload = {
        ...formData,
        authors: formData.authors
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        copy_count: Math.max(0, Number(formData.copy_count) || 0),
        additional_copies: Math.max(0, Number(formData.additional_copies) || 0),
        pages: formData.pages ? Number(formData.pages) : null
      };

      if (editingBookId) {
        await booksAPI.update(editingBookId, payload);
        setSuccessMessage(
          payload.additional_copies > 0
            ? `Book updated successfully and ${payload.additional_copies} copie${payload.additional_copies === 1 ? 'y was' : 's were'} added.`
            : 'Book updated successfully.'
        );
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
      setIsAddBookOpen(true);
      setFormData({
        title: book.title || '',
        isbn: book.isbn || '',
        isbn13: book.isbn13 || '',
        authors: Array.isArray(book.authors)
          ? book.authors
              .map((author) => `${author.first_name || ''} ${author.last_name || ''}`.trim())
              .filter(Boolean)
              .join(', ')
          : '',
        copy_count: String(book.copies?.length || 0),
        additional_copies: '0',
        description: book.description || '',
        pages: book.pages || '',
        publication_date: book.publication_date || '',
        language: book.language || 'English',
        format: book.format || 'Hardcover',
        cover_image_url: book.cover_image_url || ''
      });
      setSearchParams({ view: 'dashboard' });
    } catch (err) {
      console.error('Error loading book details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load book details');
    }
  };

  const handleViewDetails = async (bookId) => {
    try {
      setDetailLoading(true);
      setError(null);
      const response = await booksAPI.getById(bookId);
      setSelectedBook(response.data);
      setSelectedCopyId(response.data?.copies?.[0]?.id || null);
    } catch (err) {
      console.error('Error loading book details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load book details');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedBook(null);
    setDetailLoading(false);
    setSelectedCopyId(null);
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

      if (selectedBook?.id === bookId) {
        closeDetails();
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

  const languageOptions = Array.from(
    new Set(
      books
        .map((book) => String(book.language || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  const formatOptions = Array.from(
    new Set(
      books
        .map((book) => String(book.format || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  const filteredBooks = books.filter((book) => {
    if (filters.format !== 'all' && (book.format || 'Unknown') !== filters.format) {
      return false;
    }

    if (
      filters.availability !== 'all' &&
      getAvailabilityLabel(book).toLowerCase() !== filters.availability
    ) {
      return false;
    }

    if (filters.language !== 'all' && (book.language || 'Unknown') !== filters.language) {
      return false;
    }

    return true;
  });

  const displayedBooks = [...filteredBooks].sort((left, right) => {
    let leftValue;
    let rightValue;

    switch (sortConfig.key) {
      case 'publication_date':
        leftValue = left.publication_date ? new Date(left.publication_date).getTime() : null;
        rightValue = right.publication_date ? new Date(right.publication_date).getTime() : null;
        break;
      case 'available_copies':
        leftValue = left.available_copies || 0;
        rightValue = right.available_copies || 0;
        break;
      case 'language':
        leftValue = left.language || 'Unknown';
        rightValue = right.language || 'Unknown';
        break;
      case 'format':
        leftValue = left.format || 'Unknown';
        rightValue = right.format || 'Unknown';
        break;
      default:
        leftValue = left.title || '';
        rightValue = right.title || '';
        break;
    }

    const comparison = compareValues(leftValue, rightValue);
    if (comparison !== 0) {
      return sortConfig.direction === 'asc' ? comparison : comparison * -1;
    }

    return String(left.title || '').localeCompare(String(right.title || ''));
  });

  const hasActiveFilters = Object.values(filters).some((value) => value !== 'all');
  const totalBooks = displayedBooks.length;
  const totalCopies = displayedBooks.reduce((sum, book) => sum + (book.total_copies || 0), 0);
  const totalAvailableCopies = displayedBooks.reduce((sum, book) => sum + (book.available_copies || 0), 0);
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
                <div className="flex flex-col gap-3 sm:flex-row">
                  {activeView === 'dashboard' && (
                    <button
                      type="button"
                      onClick={handleOpenAddBook}
                      className="rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400"
                    >
                      Add Book
                    </button>
                  )}
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
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-700">
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
                <form onSubmit={handleSearch} className="mb-6">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search books by title, ISBN, or description..." className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700">Search</button>
                    <button type="button" onClick={handleResetSearch} className="rounded-lg bg-gray-300 px-6 py-2 text-gray-800 transition hover:bg-gray-400">Reset</button>
                  </div>
                </form>

                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Books On Screen</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-900">Sort and Filter the Catalog</h3>
                      <p className="mt-2 max-w-2xl text-sm text-slate-600">
                        Use column sorting and dropdown filters to focus on the books currently visible in the dashboard.
                      </p>
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Format</span>
                      <select
                        name="format"
                        value={filters.format}
                        onChange={handleFilterChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="all">All formats</option>
                        {formatOptions.map((format) => (
                          <option key={format} value={format}>
                            {format}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Availability</span>
                      <select
                        name="availability"
                        value={filters.availability}
                        onChange={handleFilterChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="all">All availability</option>
                        <option value="available">Available</option>
                        <option value="borrowed">Borrowed</option>
                        <option value="no copies">No copies</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Language</span>
                      <select
                        name="language"
                        value={filters.language}
                        onChange={handleFilterChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="all">All languages</option>
                        {languageOptions.map((language) => (
                          <option key={language} value={language}>
                            {language}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 xl:hidden">
                    {sortOptions.map((option) => {
                      const isActiveSort = sortConfig.key === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleSortChange(option.key)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            isActiveSort
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {option.label}
                          {isActiveSort ? ` (${sortConfig.direction})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isSearching && (
                  <div className="mb-4 text-sm text-gray-600">
                    Showing search results for "{searchQuery.trim()}".
                  </div>
                )}

                {(isSearching || hasActiveFilters) && (
                  <div className="mb-4 text-sm text-slate-600">
                    Displaying {displayedBooks.length} book{displayedBooks.length === 1 ? '' : 's'}
                    {hasActiveFilters ? ' after filters' : ''}.
                  </div>
                )}

                {books.length === 0 ? (
                  <div className="rounded-2xl bg-white py-12 text-center shadow-sm">
                    <p className="text-xl text-gray-600">No books found.</p>
                  </div>
                ) : displayedBooks.length === 0 ? (
                  <div className="rounded-2xl bg-white py-12 text-center shadow-sm">
                    <p className="text-xl text-gray-700">No books match the current filters.</p>
                    <p className="mt-2 text-sm text-gray-500">Try another format, language, or availability option.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:block">
                      <div className="grid grid-cols-[minmax(0,2.3fr)_1.2fr_1fr_1fr_1.1fr_1.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-left text-sm font-semibold text-slate-700">
                        {sortOptions.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => handleSortChange(option.key)}
                            className="text-left transition hover:text-blue-700"
                          >
                            {option.label}
                            {sortConfig.key === option.key ? ` (${sortConfig.direction})` : ''}
                          </button>
                        ))}
                        <div className="text-right">Actions</div>
                      </div>

                      {displayedBooks.map((book) => (
                        <div
                          key={book.id}
                          className="grid grid-cols-[minmax(0,2.3fr)_1.2fr_1fr_1fr_1.1fr_1.7fr] gap-4 border-b border-slate-100 px-6 py-5 last:border-b-0"
                        >
                          <div>
                            <h2 className="text-lg font-semibold text-slate-900">{book.title}</h2>
                            <p className="mt-1 text-sm text-slate-600">
                              {book.publisher_name || 'Unknown Publisher'}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              {book.isbn ? `ISBN ${book.isbn}` : 'No ISBN recorded'}
                            </p>
                          </div>
                          <div className="text-sm text-slate-700">
                            {formatDisplayDate(book.publication_date)}
                          </div>
                          <div className="text-sm text-slate-700">{book.format || 'Unknown'}</div>
                          <div className="text-sm text-slate-700">{book.language || 'Unknown'}</div>
                          <div>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityBadgeClasses(book)}`}
                            >
                              {getAvailabilityLabel(book)}
                            </span>
                            <p className="mt-2 text-xs text-slate-500">
                              {book.available_copies || 0} of {book.total_copies || 0} copies
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 justify-self-end">
                            <button type="button" onClick={() => handleViewDetails(book.id)} className="min-w-[92px] rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                              Details
                            </button>
                            <button type="button" onClick={() => navigate(`/checkout?bookId=${book.id}`)} className="min-w-[92px] rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                              Checkout
                            </button>
                            <button type="button" onClick={() => handleEdit(book.id)} className="min-w-[92px] rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-600">
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDelete(book.id, book.title)} className="min-w-[92px] rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700">
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:hidden">
                      {displayedBooks.map((book) => (
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

                            <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-gray-700">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Language</p>
                                <p className="mt-1 font-medium text-slate-900">{book.language || 'Unknown'}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Published</p>
                                <p className="mt-1 font-medium text-slate-900">
                                  {formatDisplayDate(book.publication_date)}
                                </p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Availability</p>
                                <p className="mt-1 font-medium text-slate-900">{getAvailabilityLabel(book)}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Copies</p>
                                <p className="mt-1 font-medium text-slate-900">
                                  {book.available_copies || 0} / {book.total_copies || 0}
                                </p>
                              </div>
                            </div>

                            <div className="mb-4 space-y-2 text-sm text-gray-700">
                              {book.isbn && <p>ISBN: {book.isbn}</p>}
                              {book.pages && <p>Pages: {book.pages}</p>}
                              {book.category_name && <p>Category: {book.category_name}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                              <button type="button" onClick={() => handleViewDetails(book.id)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                                View Details
                              </button>
                              <button type="button" onClick={() => navigate(`/checkout?bookId=${book.id}`)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                                Checkout
                              </button>
                              <button type="button" onClick={() => handleEdit(book.id)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600">
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDelete(book.id, book.title)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700">
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!isSearching && totalPages > 1 && (
                      <div className="mt-8 flex justify-center gap-2">
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
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
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

                        {loan.notes && (
                          <div className="mt-4 rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Notes
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{loan.notes}</p>
                          </div>
                        )}

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

      {(detailLoading || selectedBook) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Book Details
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">
                  {selectedBook?.title || 'Loading details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            {detailLoading && !selectedBook ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="mt-4 text-slate-600">Loading book details...</p>
              </div>
            ) : selectedBook ? (
              <div className="grid gap-8 px-6 py-6 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <div className="overflow-hidden rounded-3xl bg-slate-100">
                    {selectedBook.cover_image_url ? (
                      <img
                        src={selectedBook.cover_image_url}
                        alt={`${selectedBook.title} cover`}
                        className="h-80 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-80 items-center justify-center bg-[linear-gradient(135deg,_#dbeafe,_#e2e8f0)] px-8 text-center text-slate-500">
                        No cover image available
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                      {selectedBook.format || 'Unknown format'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      {selectedBook.language || 'Unknown language'}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${getAvailabilityBadgeClasses(selectedBook)}`}
                    >
                      {getAvailabilityLabel(selectedBook) === 'Available'
                        ? 'Available copies'
                        : getAvailabilityLabel(selectedBook) === 'Borrowed'
                          ? 'All copies borrowed'
                          : 'No copies added yet'}
                    </span>
                  </div>

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-lg font-semibold text-slate-900">Description</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {selectedBook.description || 'No description has been added for this book yet.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {(() => {
                    const copies = selectedBook.copies || [];
                    const selectedCopy = copies.find((copy) => copy.id === selectedCopyId) || copies[0] || null;

                    return (
                      <>
                  <div className="rounded-3xl border border-slate-200 p-5">
                    <h4 className="text-lg font-semibold text-slate-900">Catalog Summary</h4>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-slate-500">Publisher</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {selectedBook.publisher_name || 'Unknown Publisher'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-slate-500">Category</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {selectedBook.category_name || 'General'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-slate-500">Publication Date</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {formatDisplayDate(selectedBook.publication_date)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-slate-500">Pages</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {selectedBook.pages || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 p-5">
                    <h4 className="text-lg font-semibold text-slate-900">Identifiers</h4>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-900">ISBN:</span>{' '}
                        {selectedBook.isbn || 'Not recorded'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">ISBN-13:</span>{' '}
                        {selectedBook.isbn13 || 'Not recorded'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">Authors:</span>{' '}
                        {getAuthorLabel(selectedBook.authors)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-slate-900">Copies</h4>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {(selectedBook.copies || []).length} total
                      </span>
                    </div>

                    {(selectedBook.copies || []).length === 0 ? (
                      <p className="mt-4 text-sm text-slate-600">No copy records are attached yet.</p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                          <div className="rounded-2xl bg-slate-50 px-3 py-3 text-slate-700">
                            {copies.length} Total
                          </div>
                          <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-emerald-700">
                            {copies.filter((copy) => copy.status === 'Available').length} Available
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-3 py-3 text-amber-700">
                            {copies.filter((copy) => copy.status !== 'Available').length} Unavailable
                          </div>
                        </div>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Select a copy</span>
                          <select
                            value={selectedCopy?.id || ''}
                            onChange={(e) => setSelectedCopyId(Number(e.target.value))}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            {copies.map((copy) => (
                              <option key={copy.id} value={copy.id}>
                                Copy #{copy.copy_number || copy.id} - {copy.status}
                              </option>
                            ))}
                          </select>
                        </label>

                        {selectedCopy && (
                          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  Copy #{selectedCopy.copy_number || selectedCopy.id}
                                </p>
                                <p className="mt-1 text-slate-600">
                                  Barcode: {selectedCopy.barcode || 'Not recorded'}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  selectedCopy.status === 'Available'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {selectedCopy.status}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="rounded-xl bg-white p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Condition</p>
                                <p className="mt-1 font-medium text-slate-900">
                                  {selectedCopy.condition || 'Not recorded'}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Acquired</p>
                                <p className="mt-1 font-medium text-slate-900">
                                  {selectedCopy.acquisition_date
                                    ? formatDisplayDate(selectedCopy.acquisition_date)
                                    : 'Not recorded'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl bg-white p-3">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
                              <p className="mt-1 font-medium text-slate-900">
                                {[selectedCopy.location_shelf, selectedCopy.location_rack]
                                  .filter(Boolean)
                                  .join(' | ') || 'Not recorded'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {isAddBookOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Catalog Tools
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">
                  {editingBookId ? 'Edit Book' : 'Add Book'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {editingBookId
                    ? 'Update the selected book and save your changes.'
                    : 'Create a new catalog entry in a focused popup form.'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-6">
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
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    {editingBookId ? 'Current Copies' : 'Number of Copies'}
                  </span>
                  <input
                    name="copy_count"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.copy_count}
                    onChange={handleFormChange}
                    disabled={Boolean(editingBookId)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <span className="mt-1 block text-xs text-gray-500">
                    {editingBookId
                      ? 'This is the current total. Editing a book will not reduce these existing copies.'
                      : 'Minimum is 0. Negative values are not allowed.'}
                  </span>
                </label>
                {editingBookId && (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Add More Copies</span>
                    <input
                      name="additional_copies"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.additional_copies}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      This adds copies on top of the current total. It cannot go below 0 or reduce existing stock.
                    </span>
                  </label>
                )}
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
                  <span className="mb-1 block text-sm font-medium text-gray-700">Authors</span>
                  <input name="authors" type="text" value={formData.authors} onChange={handleFormChange} placeholder="Andy Weir, Another Author" className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  <span className="mt-1 block text-xs text-gray-500">
                    Separate multiple authors with commas.
                  </span>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
                  <textarea name="description" rows="4" value={formData.description} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </label>
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : editingBookId ? 'Update Book' : 'Add Book'}
                  </button>
                  <button type="button" onClick={clearFormFields} className="rounded-lg bg-gray-200 px-6 py-2 font-medium text-gray-800 transition hover:bg-gray-300">
                    {editingBookId ? 'Clear Changes' : 'Clear Form'}
                  </button>
                  <button type="button" onClick={resetForm} className="rounded-lg bg-slate-100 px-6 py-2 font-medium text-slate-700 transition hover:bg-slate-200">
                    {editingBookId ? 'Cancel Edit' : 'Close'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

