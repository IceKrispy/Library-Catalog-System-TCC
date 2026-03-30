import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { booksAPI, circulationAPI } from '../services/api';
import { buildLocalDueDatePreview, today } from '../utils/loanPreview';

const emptyCheckoutForm = {
  bookId: '',
  bookTitle: '',
  copyId: '',
  borrowerName: '',
  borrowerEmail: '',
  borrowerId: '',
  itemType: 'book',
  checkoutDate: today(),
  notes: ''
};

function getItemTypeFromFormat(format) {
  const normalized = String(format || 'book').toLowerCase();
  if (normalized === 'hardcover' || normalized === 'paperback' || normalized === 'audiobook') {
    return normalized;
  }
  if (normalized === 'ebook' || normalized === 'e-book') {
    return 'ebook';
  }
  return 'book';
}

export default function CheckoutPage({ user, onLogout }) {
  const [searchParams] = useSearchParams();
  const requestedBookId = searchParams.get('bookId') || '';

  const [books, setBooks] = useState([]);
  const [loanPolicies, setLoanPolicies] = useState([]);
  const [dueDatePreview, setDueDatePreview] = useState(null);
  const [availableCopies, setAvailableCopies] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState(emptyCheckoutForm);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const selectedBook = useMemo(
    () => books.find((book) => String(book.id) === checkoutForm.bookId),
    [books, checkoutForm.bookId]
  );

  const calculatePreview = async (itemType, checkoutDate, policiesOverride = loanPolicies) => {
    try {
      const response = await circulationAPI.calculateDueDate(itemType, checkoutDate);
      setDueDatePreview(response.data.data);
      setError('');
    } catch (err) {
      const localPreview = buildLocalDueDatePreview(itemType, checkoutDate, policiesOverride);
      if (localPreview) {
        setDueDatePreview(localPreview);
        return;
      }

      setError(err.response?.data?.message || err.message || 'Failed to calculate due date');
    }
  };

  const loadBookDetails = async (bookId) => {
    if (!bookId) {
      setAvailableCopies([]);
      return;
    }

    try {
      const response = await booksAPI.getById(bookId);
      const book = response.data;
      const copies = (book.copies || []).filter((copy) => copy.status === 'Available');
      const itemType = getItemTypeFromFormat(book.format);

      setAvailableCopies(copies);
      setCheckoutForm((current) => ({
        ...current,
        bookId: String(book.id),
        bookTitle: book.title,
        copyId: copies[0] ? String(copies[0].id) : '',
        itemType
      }));
      await calculatePreview(itemType, checkoutForm.checkoutDate || today());
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load book details');
    }
  };

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const [booksResponse, policiesResponse] = await Promise.all([
          booksAPI.getAll(1, 100),
          circulationAPI.getLoanPolicies()
        ]);

        const nextBooks = booksResponse.data.data;
        const policies = policiesResponse.data.data;

        setBooks(nextBooks);
        setLoanPolicies(policies);

        const initialBookId = requestedBookId || (nextBooks[0] ? String(nextBooks[0].id) : '');
        if (initialBookId) {
          await loadBookDetails(initialBookId);
        } else if (policies.length > 0) {
          await calculatePreview('book', today(), policies);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load checkout data');
      }
    };

    loadPageData();
  }, [requestedBookId]);

  const handleChange = async (e) => {
    const { name, value } = e.target;

    if (name === 'bookId') {
      setCheckoutForm((current) => ({
        ...current,
        bookId: value
      }));
      await loadBookDetails(value);
      return;
    }

    const next = { ...checkoutForm, [name]: value };
    setCheckoutForm(next);

    if (name === 'itemType' || name === 'checkoutDate') {
      await calculatePreview(next.itemType, next.checkoutDate);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsCheckingOut(true);
      setError('');
      setSuccessMessage('');

      await circulationAPI.checkout({
        copy_id: Number(checkoutForm.copyId),
        borrower_name: checkoutForm.borrowerName,
        borrower_email: checkoutForm.borrowerEmail || null,
        borrower_id: checkoutForm.borrowerId || null,
        item_type: checkoutForm.itemType,
        checkout_date: checkoutForm.checkoutDate,
        notes: checkoutForm.notes || null
      });

      setSuccessMessage(`Checked out "${checkoutForm.bookTitle}" successfully.`);
      const currentBookId = checkoutForm.bookId;
      setCheckoutForm({
        ...emptyCheckoutForm,
        bookId: currentBookId
      });
      await loadBookDetails(currentBookId);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to check out book');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AppSidebar user={user} onLogout={onLogout} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 rounded-3xl bg-[linear-gradient(135deg,_#1d4ed8,_#0f172a)] p-6 text-white shadow-xl">
              <p className="text-sm uppercase tracking-[0.25em] text-blue-100">Circulation Tools</p>
              <h2 className="mt-2 text-3xl font-bold">Checkout Panel</h2>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                Use a dedicated page for borrower checkout so the main dashboard stays focused on catalog management.
              </p>
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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-2xl font-semibold text-slate-900">Checkout Book</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Select a book, choose an available copy, and store the borrower transaction.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Book</span>
                    <select
                      name="bookId"
                      value={checkoutForm.bookId}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Select a book</option>
                      {books.map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Available Copy</span>
                    <select
                      name="copyId"
                      value={checkoutForm.copyId}
                      onChange={handleChange}
                      disabled={availableCopies.length === 0}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                    >
                      {availableCopies.length === 0 ? (
                        <option value="">No available copies</option>
                      ) : (
                        availableCopies.map((copy) => (
                          <option key={copy.id} value={copy.id}>
                            {copy.barcode} - Copy #{copy.copy_number}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Borrower Name</span>
                    <input
                      name="borrowerName"
                      type="text"
                      value={checkoutForm.borrowerName}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Borrower Email</span>
                      <input
                        name="borrowerEmail"
                        type="email"
                        value={checkoutForm.borrowerEmail}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Borrower ID</span>
                      <input
                        name="borrowerId"
                        type="text"
                        value={checkoutForm.borrowerId}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Item Type</span>
                      <select
                        name="itemType"
                        value={checkoutForm.itemType}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        {loanPolicies.map((policy) => (
                          <option key={policy.itemType} value={policy.itemType}>
                            {policy.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Checkout Date</span>
                      <input
                        name="checkoutDate"
                        type="date"
                        value={checkoutForm.checkoutDate}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Notes</span>
                    <textarea
                      name="notes"
                      rows="4"
                      value={checkoutForm.notes}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={
                      isCheckingOut ||
                      !checkoutForm.bookId ||
                      !checkoutForm.copyId ||
                      !checkoutForm.borrowerName.trim()
                    }
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCheckingOut ? 'Checking Out...' : 'Confirm Checkout'}
                  </button>
                </form>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-2xl font-semibold text-slate-900">Checkout Summary</h3>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Selected Book</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {checkoutForm.bookTitle || selectedBook?.title || 'No book selected'}
                  </p>
                </div>

                {dueDatePreview && (
                  <div className="mt-4 rounded-2xl bg-blue-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-700">{dueDatePreview.label}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {dueDatePreview.loanPeriodDays} days
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-slate-500">Checkout</p>
                        <p className="mt-1 font-semibold text-slate-900">{dueDatePreview.checkoutDate}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-slate-500">Due Date</p>
                        <p className="mt-1 font-semibold text-slate-900">{dueDatePreview.dueDate}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Available copies</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {availableCopies.length === 0 ? (
                      <p>No available copies for the selected book.</p>
                    ) : (
                      availableCopies.map((copy) => (
                        <div key={copy.id} className="flex items-center justify-between">
                          <span>{copy.barcode}</span>
                          <span className="font-semibold text-slate-900">Copy #{copy.copy_number}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
